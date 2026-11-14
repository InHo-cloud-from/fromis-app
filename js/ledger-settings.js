// 가계부 설정: 분류·덕질 항목·결제수단·수입 구분 관리, 예산 편집
import { openSheet, toast, confirmSheet, icon, esc, uid } from './ui.js';
import { notifyChange } from './data.js';
import * as L from './ledger-data.js';

const LIST_INFO = {
  cats: { title: '지출 분류', note: '지출을 입력할 때 고르는 대분류예요. 삭제해도 예전 내역의 분류 이름은 그대로 남아요. \'덕질\'은 덕질 요약에 쓰여서 지울 수 없어요.', ph: '새 분류 (예: 반려동물)', fixed: [L.FANDOM] },
  subs: { title: '덕질 항목', note: '분류에서 \'덕질\'을 고르면 나오는 세부 항목이에요.', ph: '새 항목 (예: 생일카페)' },
  pays: { title: '결제수단', note: '\'카드\'로 표시한 수단으로 쓴 돈은 현금 흐름에서 빠지고, 카드값 납부할 때 고를 수 있어요. 카드가 여러 장이면 각각 추가해 두세요 (예: 현대카드).', ph: '새 결제수단', card: true },
  incomeKinds: { title: '수입 구분', note: '수입을 입력할 때 고르는 구분이에요.', ph: '새 구분 (예: 중고판매)' },
};

export async function openListManager(name) {
  const info = LIST_INFO[name];
  const s = openSheet({
    title: info.title,
    body: `<p class="set-note">${esc(info.note)}</p><ul class="mgr-list"></ul>
      <form class="add-inline"><input placeholder="${esc(info.ph)}" aria-label="${esc(info.ph)}"><button class="btn btn-primary" type="submit">추가</button></form>`,
  });
  const ul = s.body.querySelector('.mgr-list');
  const form = s.body.querySelector('form');
  let list = await L.getList(name);

  const save = async () => { await L.saveList(name, list); notifyChange(); };
  const render = () => {
    const vis = L.visible(list);
    ul.innerHTML = vis.map((x, i) => `<li data-id="${esc(x.id)}">
      <input class="mgr-name" value="${esc(x.name)}" aria-label="${esc(x.name)} 이름">
      ${info.card ? `<label class="mgr-card"><input type="checkbox" ${x.card ? 'checked' : ''}> 카드</label>` : ''}
      <button type="button" class="icon-btn sm" data-up aria-label="${esc(x.name)} 위로" ${i === 0 ? 'disabled' : ''}>${icon('chevron', 'up')}</button>
      ${(info.fixed || []).includes(x.id) ? '<span class="icon-btn sm" aria-hidden="true"></span>' : `<button type="button" class="icon-btn sm" data-del aria-label="${esc(x.name)} 삭제">${icon('x')}</button>`}
    </li>`).join('');
  };
  render();

  ul.addEventListener('change', async (e) => {
    const li = e.target.closest('li');
    const item = list.find((x) => x.id === li?.dataset.id);
    if (!item) return;
    if (e.target.matches('.mgr-name')) {
      const v = e.target.value.trim();
      if (!v) { e.target.value = item.name; return; }
      item.name = v;
    } else if (e.target.type === 'checkbox') item.card = e.target.checked;
    await save();
  });
  ul.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const idx = list.findIndex((x) => x.id === li.dataset.id);
    if (e.target.closest('[data-up]')) {
      // 숨긴 항목은 건너뛰고 바로 위 보이는 항목과 자리 바꾸기
      let j = idx - 1;
      while (j >= 0 && list[j].hidden) j--;
      if (j < 0) return;
      [list[j], list[idx]] = [list[idx], list[j]];
      await save(); render();
    } else if (e.target.closest('[data-del]')) {
      if (!(await confirmSheet(`'${list[idx].name}'을(를) 목록에서 뺄까요? 예전 내역은 그대로 남아요.`, { ok: '빼기', danger: true }))) return;
      list[idx] = { ...list[idx], hidden: true };
      await save(); render();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = form.querySelector('input');
    const v = inp.value.trim();
    inp.value = '';
    if (!v) return;
    const dup = list.find((x) => x.name === v);
    if (dup && !dup.hidden) { toast('이미 있어요'); return; }
    if (dup) dup.hidden = false; // 예전에 뺀 걸 다시 추가
    else list.push({ id: uid(), name: v, ...(info.card ? { card: false } : {}) });
    await save(); render();
  });
}

/* ---------- 예산 ---------- */
export async function openBudgetEditor(ym) {
  const [cats, subs, store] = await Promise.all([L.getList('cats'), L.getList('subs'), L.getBudgetStore()]);
  let mode = store.months?.[ym] ? 'month' : 'base';
  const valuesFor = (m) => structuredClone(m === 'month' ? (store.months?.[ym] || store.base) : store.base) || { total: null, cats: {} };
  let cur = valuesFor(mode);

  const s = openSheet({
    title: '예산',
    body: '<form class="form budget-form" novalidate></form>',
    footer: '<button type="button" class="btn btn-primary" data-act="save">저장</button>',
  });
  const form = s.body.firstElementChild;
  const fmt = (n) => (n ? Number(n).toLocaleString('ko-KR') : '');
  const input = (key, label, cls = '') => `<div class="budget-row ${cls}"><label for="b-${esc(key)}">${esc(label)}</label>
    <input id="b-${esc(key)}" data-key="${esc(key)}" inputmode="numeric" autocomplete="off" placeholder="없음" value="${fmt(key === 'total' ? cur.total : cur.cats?.[key])}"></div>`;

  const sumText = () => {
    const sum = L.visible(cats).reduce((a, c) => a + (Number(cur.cats?.[c.id]) || 0), 0);
    return `합계 ${L.won(sum)}${cur.total && sum > cur.total ? ' · 전체 예산보다 많아요' : ''}`;
  };
  function draw() {
    form.innerHTML = `
      <div class="seg" role="group" aria-label="적용 범위">
        <button type="button" data-mode="base" aria-pressed="${mode === 'base'}">매달 기본</button>
        <button type="button" data-mode="month" aria-pressed="${mode === 'month'}">${L.ymLabel(ym)}만</button>
      </div>
      <p class="hint">${mode === 'base' ? '따로 정하지 않은 달은 모두 이 예산을 써요.' : `${L.ymLabel(ym)}에만 적용돼요. 다른 달은 기본 예산을 그대로 써요.`} 비워 두면 예산 없음이에요.</p>
      <section class="budget-group">${input('total', '월 전체 예산', 'strong')}</section>
      <section class="budget-group">
        <h3>분류별 <small class="b-sum">${sumText()}</small></h3>
        <p class="hint">덕질 아래 항목 예산은 덕질 예산 안에서 따로 보는 용도라 합계에 안 들어가요.</p>
        ${L.visible(cats).map((c) => input(c.id, c.name) + (c.id === L.FANDOM ? L.visible(subs).map((x) => input('sub:' + x.id, x.name, 'sub')).join('') : '')).join('')}
      </section>
      ${mode === 'month' && store.months?.[ym] ? '<button type="button" class="btn btn-danger-ghost" data-act="reset">이 달 예산 지우고 기본으로</button>' : ''}`;
  }
  draw();

  form.addEventListener('input', (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    const n = L.parseWon(e.target.value);
    e.target.value = fmt(n);
    if (key === 'total') cur.total = n || null;
    else { cur.cats = cur.cats || {}; if (n) cur.cats[key] = n; else delete cur.cats[key]; }
    form.querySelector('.b-sum').textContent = sumText();
  });
  form.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m && m.dataset.mode !== mode) { mode = m.dataset.mode; cur = valuesFor(mode); draw(); return; }
    if (e.target.closest('[data-act="reset"]')) {
      if (!(await confirmSheet(`${L.ymLabel(ym)}만 따로 정한 예산을 지울까요?`, { ok: '지우기', danger: true }))) return;
      delete store.months[ym];
      await L.saveBudgetStore(store);
      notifyChange();
      await s.close();
      toast('기본 예산으로 돌아갔어요');
    }
  });
  s.foot.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="save"]')) return;
    const clean = { total: cur.total || null, cats: { ...(cur.cats || {}) } };
    if (mode === 'base') store.base = clean;
    else { store.months = store.months || {}; store.months[ym] = clean; }
    await L.saveBudgetStore(store);
    notifyChange();
    await s.close();
    toast('예산을 저장했어요');
  });
}
