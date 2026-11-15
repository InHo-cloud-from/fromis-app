// 가계부 3단계 (덕질만 보기): 응모 기록, 구매 예정(위시)
import { DB } from './db.js';
import { icon, esc, uid, openSheet, toast, confirmSheet, today } from './ui.js';
import { MEMBERS, notifyChange } from './data.js';
import * as L from './ledger-data.js';

/* ---------- 데이터 ----------
   meta 'fandom.applies' = [{ id, title, shop, date(응모일), deadline, count, amount, pay, result: 'wait'|'win'|'lose', member, memo }]
     → 저장하면 지출 내역 'apply-<id>' (덕질 · 팬싸·영통 응모) 도 같이 만들거나 고침
   meta 'fandom.wishes' = [{ id, name, amount(예상), deadline, sub, member, memo, done, txId, doneDate }] */
export const RESULTS = { wait: '대기', win: '당첨', lose: '낙첨' };
export async function getApplies() { return (await DB.getMeta('fandom.applies')) || []; }
export async function getWishes() { return (await DB.getMeta('fandom.wishes')) || []; }
const saveApplies = (v) => DB.setMeta('fandom.applies', v);
export const saveWishes = (v) => DB.setMeta('fandom.wishes', v);

const daysLeft = (date) => {
  if (!date) return null;
  const a = new Date(today() + 'T00:00'), b = new Date(date + 'T00:00');
  return Math.round((b - a) / 86400000);
};
const dText = (n) => (n === null ? '' : n === 0 ? 'D-day' : n > 0 ? `D-${n}` : '지남');
const md = (date) => (date ? `${Number(date.slice(5, 7))}.${Number(date.slice(8))}` : '');

async function syncApplyTx(a) {
  const id = `apply-${a.id}`;
  const old = await DB.get('tx', id);
  if (!a.amount) { if (old) await DB.del('tx', id); return; }
  await DB.put('tx', {
    ...(old || {}), id, type: 'expense', date: a.date, amount: a.amount, cat: L.FANDOM, sub: 's-apply',
    member: a.member || null, place: `${a.title} 응모${a.count ? ` ${a.count}장` : ''}`, pay: a.pay || null,
    memo: [a.shop, a.memo].filter(Boolean).join(' · '), rec: { apply: a.id },
    createdAt: old?.createdAt || Date.now(), updatedAt: Date.now(),
  });
}

export function applyStats(applies) {
  const win = applies.filter((a) => a.result === 'win').length;
  const lose = applies.filter((a) => a.result === 'lose').length;
  const wait = applies.filter((a) => a.result === 'wait').length;
  return { win, lose, wait, rate: win + lose ? win / (win + lose) : null };
}

/* ---------- 화면: 응모·위시 ---------- */
export function fandomHTML({ applies, wishes, subs, budget, fandomSpent }) {
  const st = applyStats(applies);
  const year = today().slice(0, 4);
  const yearApplies = applies.filter((a) => a.date?.startsWith(year));
  const yearAmount = yearApplies.reduce((s, a) => s + (a.amount || 0), 0);
  const order = { wait: 0, win: 1, lose: 1 };
  const sorted = [...applies].sort((a, b) => order[a.result] - order[b.result]
    || (a.result === 'wait' ? (a.deadline || '9').localeCompare(b.deadline || '9') : (b.date || '').localeCompare(a.date || '')));

  const applyRows = sorted.map((a) => {
    const dl = a.result === 'wait' ? daysLeft(a.deadline) : null;
    return `<li><button type="button" class="m-row" data-apply="${esc(a.id)}">
      <span class="m-main"><b>${esc(a.title)}</b><small>${[a.shop, a.count ? `${a.count}장` : '', a.member, a.result === 'wait' && a.deadline ? `마감 ${md(a.deadline)} (${dText(dl)})` : md(a.date)].filter(Boolean).map(esc).join(' · ')}</small></span>
      <span class="m-side"><span class="result r-${a.result}">${RESULTS[a.result]}</span><small>${a.amount ? L.won(a.amount) : ''}</small></span>
    </button></li>`;
  }).join('');

  const open = wishes.filter((w) => !w.done).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
  const done = wishes.filter((w) => w.done).sort((a, b) => (b.doneDate || '').localeCompare(a.doneDate || ''));
  const planned = open.reduce((s, w) => s + (w.amount || 0), 0);
  const left = budget ? budget - fandomSpent : null;
  const wishRows = open.map((w) => {
    const dl = daysLeft(w.deadline);
    return `<li class="wish-li"><button type="button" class="m-row" data-wish="${esc(w.id)}">
      <span class="m-main"><b>${esc(w.name)}</b><small>${[L.nameOf(subs, w.sub), w.member, w.deadline ? `마감 ${md(w.deadline)} (${dText(dl)})` : ''].filter(Boolean).map(esc).join(' · ')}</small></span>
      <span class="m-side"><b>${w.amount ? L.won(w.amount) : '-'}</b></span>
    </button><button type="button" class="btn btn-sm bought-btn" data-bought="${esc(w.id)}">샀어요</button></li>`;
  }).join('');

  return `<div class="ledger-grid">
    <section class="panel">
      <div class="panel-head"><h3>응모 기록</h3><button type="button" class="btn-link" data-addapply>${icon('plus')} 추가</button></div>
      ${applies.length ? `<div class="apply-stats">
          <span><small>당첨률</small><b>${st.rate === null ? '-' : Math.round(st.rate * 100) + '%'}</b><small>${st.win}/${st.win + st.lose}</small></span>
          <span><small>결과 대기</small><b>${st.wait}건</b></span>
          <span><small>${year}년 응모 금액</small><b>${L.won(yearAmount)}</b></span>
        </div>
        <ul class="m-list">${applyRows}</ul>`
        : '<p class="hint pad">팬싸·영통 응모를 기록하면 당첨률과 응모에 쓴 돈을 보여줘요. 응모 금액은 \'덕질 · 팬싸·영통 응모\' 지출로 같이 들어가요.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>구매 예정</h3><button type="button" class="btn-link" data-addwish>${icon('plus')} 추가</button></div>
      ${open.length ? `<ul class="m-list">${wishRows}</ul>
        <dl class="flow wish-sum">
          <dt>살 것 합계</dt><dd>${L.won(planned)}</dd>
          ${left !== null ? `<dt>이번 달 덕질 예산 남은 돈</dt><dd>${L.won(left)}</dd>
          <dt class="total">다 사면</dt><dd class="total ${left - planned < 0 ? 'neg' : ''}">${left - planned < 0 ? `${L.won(planned - left)} 초과` : `${L.won(left - planned)} 남음`}</dd>` : ''}
        </dl>${left === null ? '<p class="hint">덕질 예산을 정하면 다 샀을 때 얼마 남는지도 보여줘요.</p>' : ''}`
        : '<p class="hint pad">살 앨범·굿즈와 예상 금액, 마감일을 적어 두세요. 사면 \'샀어요\'로 바로 지출에 넣을 수 있어요.</p>'}
      ${done.length ? `<details class="wish-done"><summary>산 것 ${done.length}개</summary><ul>${done.slice(0, 30).map((w) => `<li><button type="button" data-wish="${esc(w.id)}"><span>${esc(w.name)}</span><small>${md(w.doneDate)}</small></button></li>`).join('')}</ul></details>` : ''}
    </section>
  </div>`;
}

// 덕질 요약에 작게
export function fandomMiniHTML({ applies, wishes }) {
  if (!applies.length && !wishes.length) return '';
  const st = applyStats(applies);
  const open = wishes.filter((w) => !w.done);
  return `<section class="panel">
    <div class="panel-head"><h3>응모 · 위시</h3><button type="button" class="btn-link" data-view="fandom">보기 ${icon('chevron')}</button></div>
    <dl class="flow">
      <dt>응모 결과 대기</dt><dd>${st.wait}건</dd>
      <dt>당첨률</dt><dd>${st.rate === null ? '-' : `${Math.round(st.rate * 100)}% (${st.win}/${st.win + st.lose})`}</dd>
      <dt>구매 예정</dt><dd>${open.length}개 · ${L.won(open.reduce((s, w) => s + (w.amount || 0), 0))}</dd>
    </dl>
  </section>`;
}

/* ---------- 폼 공통 ---------- */
const fmt = (n) => (n ? Number(n).toLocaleString('ko-KR') : '');
const num = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
const chipsHTML = (key, list, cur, none) => `<div class="chips wrap">${none ? `<button type="button" class="chip chip-sm" data-pick="${key}" data-v="" aria-pressed="${!cur}">${none}</button>` : ''}${list.map((x) => `<button type="button" class="chip chip-sm" data-pick="${key}" data-v="${esc(x.id)}" aria-pressed="${x.id === cur}">${esc(x.name)}</button>`).join('')}</div>`;
const memberList = MEMBERS.map((m) => ({ id: m, name: m }));

/* ---------- 응모 ---------- */
export async function openApplyForm(id) {
  const [applies, pays] = await Promise.all([getApplies(), L.getList('pays')]);
  const found = applies.find((x) => x.id === id);
  const isNew = !found;
  const a = found ? { ...found } : { id: uid(), title: '', shop: '', date: today(), deadline: '', count: 1, amount: 0, pay: L.visible(pays).find((p) => p.card)?.id || L.visible(pays)[0]?.id || null, result: 'wait', member: null, memo: '' };
  const s = openSheet({
    title: isNew ? '응모 추가' : '응모 수정',
    body: '<form class="form" novalidate></form>',
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const form = s.body.firstElementChild;
  const draw = () => {
    form.innerHTML = `
      <div class="field"><label for="a-title">행사 이름</label><input id="a-title" value="${esc(a.title)}" placeholder="예: Glow Me 대면 팬싸, 영통 2차"></div>
      <div class="field-row">
        <div class="field"><label for="a-shop">판매처</label><input id="a-shop" value="${esc(a.shop)}" placeholder="예: 위드뮤, 사운드웨이브"></div>
        <div class="field"><label for="a-count">응모 장수</label><input id="a-count" type="number" min="0" inputmode="numeric" value="${a.count || ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="a-amount">금액 <small>지출로 들어가요</small></label><input id="a-amount" inputmode="numeric" placeholder="0" value="${fmt(a.amount)}"></div>
        <div class="field"><label for="a-date">응모(구매)일</label><input id="a-date" type="date" value="${esc(a.date)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="a-deadline">응모 마감 <small>선택</small></label><input id="a-deadline" type="date" value="${esc(a.deadline || '')}"></div><div></div>
      </div>
      <div class="field"><span class="label">결과</span><div class="seg" role="group">${Object.entries(RESULTS).map(([k, n]) => `<button type="button" data-result="${k}" aria-pressed="${a.result === k}">${n}</button>`).join('')}</div></div>
      <div class="field"><span class="label">${a.result === 'win' ? '당첨 멤버' : '멤버'} <small>선택 · 영통처럼 멤버를 고르는 응모</small></span>${chipsHTML('member', memberList, a.member, '없음')}</div>
      <div class="field"><span class="label">결제수단</span>${chipsHTML('pay', L.visible(pays), a.pay)}</div>
      <div class="field"><label for="a-memo">메모 <small>선택</small></label><input id="a-memo" value="${esc(a.memo || '')}"></div>`;
  };
  draw();
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'a-amount') { a.amount = num(el.value); el.value = fmt(a.amount); return; }
    const key = { 'a-title': 'title', 'a-shop': 'shop', 'a-date': 'date', 'a-deadline': 'deadline', 'a-memo': 'memo' }[el.id];
    if (key) a[key] = el.value;
    if (el.id === 'a-count') a.count = Number(el.value) || 0;
  });
  form.addEventListener('click', (e) => {
    const r = e.target.closest('[data-result]');
    if (r) { a.result = r.dataset.result; draw(); return; }
    const p = e.target.closest('[data-pick]');
    if (p) { a[p.dataset.pick] = p.dataset.v || null; draw(); }
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const list = await getApplies();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${a.title}' 응모 기록과 그 지출을 지울까요?`, { ok: '지우기', danger: true }))) return;
      await saveApplies(list.filter((x) => x.id !== a.id));
      await DB.del('tx', `apply-${a.id}`);
      await s.close(); notifyChange(); toast('지웠어요');
      return;
    }
    if (!a.title.trim()) { toast('행사 이름을 적어주세요'); form.querySelector('#a-title')?.focus(); return; }
    if (!a.date) { toast('응모일을 골라주세요'); return; }
    a.title = a.title.trim();
    await saveApplies(isNew ? [...list, a] : list.map((x) => (x.id === a.id ? a : x)));
    await syncApplyTx(a);
    await s.close(); notifyChange();
    toast(a.amount ? `저장했어요 · ${L.won(a.amount)} 지출로 들어감` : '저장했어요');
  });
}

/* ---------- 구매 예정 ---------- */
export async function openWishForm(id) {
  const [wishes, subs] = await Promise.all([getWishes(), L.getList('subs')]);
  const found = wishes.find((x) => x.id === id);
  const isNew = !found;
  const w = found ? { ...found } : { id: uid(), name: '', amount: 0, deadline: '', sub: 's-album', member: null, memo: '', done: false };
  const s = openSheet({
    title: isNew ? '구매 예정 추가' : w.done ? '산 것' : '구매 예정 수정',
    body: '<form class="form" novalidate></form>',
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}${w.done ? '<button type="button" class="btn" data-act="undo">다시 살 것으로</button>' : ''}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const form = s.body.firstElementChild;
  const draw = () => {
    form.innerHTML = `
      ${w.done ? `<p class="hint notice">${esc(w.doneDate || '')}에 샀어요. 지출 내역은 가계부 내역에 있어요.</p>` : ''}
      <div class="field"><label for="w-name">이름</label><input id="w-name" value="${esc(w.name)}" placeholder="예: 2027 시즌그리팅, 응원봉 2"></div>
      <div class="field-row">
        <div class="field"><label for="w-amount">예상 금액</label><input id="w-amount" inputmode="numeric" placeholder="0" value="${fmt(w.amount)}"></div>
        <div class="field"><label for="w-deadline">마감 <small>예약판매 등</small></label><input id="w-deadline" type="date" value="${esc(w.deadline || '')}"></div>
      </div>
      <div class="field"><span class="label">덕질 항목</span>${chipsHTML('sub', L.visible(subs), w.sub)}</div>
      <div class="field"><span class="label">멤버 <small>선택</small></span>${chipsHTML('member', memberList, w.member, '없음')}</div>
      <div class="field"><label for="w-memo">메모 <small>선택 · 링크 등</small></label><input id="w-memo" value="${esc(w.memo || '')}"></div>`;
  };
  draw();
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'w-amount') { w.amount = num(el.value); el.value = fmt(w.amount); return; }
    const key = { 'w-name': 'name', 'w-deadline': 'deadline', 'w-memo': 'memo' }[el.id];
    if (key) w[key] = el.value;
  });
  form.addEventListener('click', (e) => { const p = e.target.closest('[data-pick]'); if (p) { w[p.dataset.pick] = p.dataset.v || null; draw(); } });
  form.addEventListener('submit', (e) => e.preventDefault());
  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const list = await getWishes();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${w.name}'을(를) 지울까요?${w.done ? ' 이미 넣은 지출 내역은 남아요.' : ''}`, { ok: '지우기', danger: true }))) return;
      await saveWishes(list.filter((x) => x.id !== w.id));
      await s.close(); notifyChange();
      return;
    }
    if (b.dataset.act === 'undo') { w.done = false; w.doneDate = null; w.txId = null; }
    if (!w.name.trim()) { toast('이름을 적어주세요'); return; }
    w.name = w.name.trim();
    await saveWishes(isNew ? [...list, w] : list.map((x) => (x.id === w.id ? w : x)));
    await s.close(); notifyChange();
    toast('저장했어요');
  });
}

// '샀어요' → 지출 폼에 채울 값
export function wishToPrefill(w) {
  return { type: 'expense', cat: L.FANDOM, sub: w.sub || null, member: w.member || null, place: w.name, amount: w.amount || 0, memo: w.memo || '' };
}
export async function markWishBought(id, tx) {
  const list = await getWishes();
  const w = list.find((x) => x.id === id);
  if (!w) return;
  Object.assign(w, { done: true, doneDate: tx.date, txId: tx.id });
  await saveWishes(list);
}
