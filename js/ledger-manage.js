// 가계부 '관리' 탭: 고정지출·할부·적금 규칙, 월급명세서
import { icon, esc, uid, openSheet, toast, confirmSheet, today } from './ui.js';
import { notifyChange } from './data.js';
import * as L from './ledger-data.js';
import * as R from './ledger-rec.js';
import { openListManager } from './ledger-settings.js';

const dayText = (d) => (d >= 31 ? '말일' : `${d}일`);

/* ---------- 관리 화면 ---------- */
export function manageHTML({ rules, allTx, payslips, cats, pays, payItems }, ym) {
  const by = (k) => rules.filter((r) => r.kind === k);
  const cur = today().slice(0, 7);
  const addBtn = (k) => `<button type="button" class="btn-link" data-addrule="${k}">${icon('plus')} 추가</button>`;

  const fixed = by('fixed');
  const fixedRows = fixed.map((r) => {
    const st = R.ruleStatus(r, allTx, cur);
    const ended = r.endYM && r.endYM < cur;
    return `<li><button type="button" class="m-row${ended || r.paused ? ' done' : ''}" data-rule="${esc(r.id)}">
      <span class="m-main"><b>${esc(r.name)}</b><small>매달 ${dayText(r.day)} · ${esc(L.nameOf(cats, r.cat, ''))}${r.pay ? ' · ' + esc(L.nameOf(pays, r.pay)) : ''}${ended ? ' · 끝남' : ''}</small></span>
      <span class="m-side"><b>${L.won(r.amount)}</b><small>${st.thisMonth ? '이번 달 들어감' : ended || r.paused ? '' : `${dayText(r.day)} 예정`}</small></span>
    </button></li>`;
  }).join('');
  const fixedSum = fixed.filter((r) => !r.paused && !(r.endYM && r.endYM < cur)).reduce((a, r) => a + r.amount, 0);

  const installs = by('install');
  const installRows = installs.map((r) => {
    const st = R.ruleStatus(r, allTx, cur);
    return `<li><button type="button" class="m-row${st.finished ? ' done' : ''}" data-rule="${esc(r.id)}">
      <span class="m-main"><b>${esc(r.name)}</b><small>${st.finished ? '다 갚았어요' : `${st.done}/${r.months}회 · 남은 ${st.left}회 ${L.won(st.leftAmount)}`} · 매달 ${dayText(r.day)}</small>
        <span class="meter thin" aria-hidden="true"><span style="width:${(st.done / r.months) * 100}%"></span></span></span>
      <span class="m-side"><b>${L.won(r.amount)}</b><small>/월</small></span>
    </button></li>`;
  }).join('');

  const savings = by('saving');
  const savingRows = savings.map((r) => {
    const st = R.ruleStatus(r, allTx, cur);
    const pct = Math.round(st.pct * 100);
    return `<li><button type="button" class="m-row" data-rule="${esc(r.id)}">
      <span class="m-main"><b>${esc(r.name)}</b><small>${r.bank ? esc(r.bank) + ' · ' : ''}${L.won(st.saved)}${st.target ? ` / ${L.won(st.target)} · ${pct}%` : ''}</small>
        ${st.target ? `<span class="meter thin" aria-hidden="true"><span style="width:${Math.min(100, pct)}%"></span></span>` : ''}</span>
      <span class="m-side"><b>${L.won(r.amount)}</b><small>매달 ${dayText(r.day)}</small></span>
    </button></li>`;
  }).join('');

  const ps = payslips[ym];
  const t = ps ? R.payslipTotals(ps) : null;
  const recent = Object.keys(payslips).sort().reverse().slice(0, 6);
  const empty = (txt) => `<p class="hint pad">${txt}</p>`;

  return `<div class="ledger-grid manage">
    <section class="panel">
      <div class="panel-head"><h3>고정지출</h3>${addBtn('fixed')}</div>
      ${fixed.length ? `<ul class="m-list">${fixedRows}</ul><p class="m-total">매달 합계 <b>${L.won(fixedSum)}</b></p>` : empty('월세·통신비·구독·보험처럼 매달 나가는 돈을 등록하면, 정한 날 내역에 자동으로 들어가요.')}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>월급명세서</h3>${ps ? `<button type="button" class="btn-link" data-payslip="${ym}">${icon('gear')} 수정</button>` : ''}</div>
      ${ps ? `<div class="pay-net"><span>${L.ymLabel(ym)} 실수령액</span><b>${L.won(t.net)}</b></div>
        <dl class="flow"><dt>지급액 계</dt><dd>${L.won(t.pay)}</dd><dt>공제액 계</dt><dd>− ${L.won(t.deduct)}</dd><dt class="ref">지급일</dt><dd class="ref">${esc(ps.date)}</dd></dl>`
        : `<button type="button" class="btn btn-block" data-payslip="${ym}">${icon('plus')} ${L.ymLabel(ym)} 명세서 입력</button>
           <p class="hint pad">저장하면 실수령액이 수입으로 들어가요. 지난달 명세서가 있으면 그 값을 불러와서 바뀐 것만 고치면 돼요.</p>`}
      ${recent.filter((k) => k !== ym).length ? `<ul class="pay-recent">${recent.filter((k) => k !== ym).map((k) => `<li><button type="button" data-payslip="${k}"><span>${L.ymLabel(k)}</span><b>${L.won(R.payslipTotals(payslips[k]).net)}</b></button></li>`).join('')}</ul>` : ''}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>할부</h3>${addBtn('install')}</div>
      ${installs.length ? `<ul class="m-list">${installRows}</ul>` : empty('할부를 등록하면 매달 회차 금액이 지출로 들어가고 남은 회차를 보여줘요.')}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>적금</h3>${addBtn('saving')}</div>
      ${savings.length ? `<ul class="m-list">${savingRows}</ul>` : empty('적금을 등록하면 매달 납입이 \'적금/저축\' 지출로 들어가고 목표까지 진행률을 보여줘요.')}
    </section>
  </div>`;
}

// 요약 화면에 작게: 이번 달 고정지출·할부·적금 합계 + 적금 진행률
export function recSummaryHTML({ rules, txs, allTx }) {
  if (!rules.length) return '';
  const kindOf = Object.fromEntries(rules.map((r) => [r.id, r.kind]));
  const sum = { fixed: 0, install: 0, saving: 0 };
  for (const t of txs) if (t.rec?.id && kindOf[t.rec.id]) sum[kindOf[t.rec.id]] += t.amount;
  const savings = rules.filter((r) => r.kind === 'saving' && r.target);
  return `<section class="panel">
    <div class="panel-head"><h3>고정 · 할부 · 적금</h3><button type="button" class="btn-link" data-view="manage">관리 ${icon('chevron')}</button></div>
    <dl class="flow">
      <dt>고정지출</dt><dd>${L.won(sum.fixed)}</dd>
      <dt>할부</dt><dd>${L.won(sum.install)}</dd>
      <dt>적금 납입</dt><dd>${L.won(sum.saving)}</dd>
    </dl>
    ${savings.map((r) => { const st = R.ruleStatus(r, allTx); const pct = Math.round(st.pct * 100); return `<div class="mini-saving"><div class="cr-top"><span>${esc(r.name)}</span><b>${pct}%</b></div><span class="meter thin" title="${esc(r.name)}: ${L.won(st.saved)} / ${L.won(st.target)}"><span style="width:${Math.min(100, pct)}%"></span></span></div>`; }).join('')}
  </section>`;
}

/* ---------- 규칙 추가·수정 ---------- */
export async function openRuleForm(kind, rule) {
  const [cats, subs, pays] = await Promise.all([L.getList('cats'), L.getList('subs'), L.getList('pays')]);
  const cur = today().slice(0, 7);
  const isNew = !rule;
  const r = rule ? structuredClone(rule) : {
    id: uid(), kind, name: '', amount: 0, day: Number(today().slice(8)), memo: '',
    cat: kind === 'install' ? null : kind === 'saving' ? 'c-saving' : 'c-fixed', sub: null,
    pay: (kind === 'saving' && L.visible(pays).find((p) => p.id === 'p-bank')?.id)
      || L.visible(pays).find((p) => (kind === 'install' ? p.card : !p.card))?.id || null,
    startYM: cur, endYM: '', fromYM: cur, skip: [],
    ...(kind === 'install' ? { total: 0, months: 3 } : {}), ...(kind === 'saving' ? { bank: '', target: 0, months: 12, paidBefore: 0 } : {}),
  };
  let amountTouched = !isNew;
  const k = r.kind;
  const s = openSheet({
    title: `${R.RULE_KINDS[k]} ${isNew ? '추가' : '수정'}`,
    body: '<form class="form rule-form" novalidate></form>',
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const form = s.body.firstElementChild;
  const fmt = (n) => (n ? Number(n).toLocaleString('ko-KR') : '');
  const opts = (list, curId) => list.filter((x) => !x.hidden || x.id === curId);
  const chips = (key, list, curId) => `<div class="chips wrap">${list.map((x) => `<button type="button" class="chip chip-sm" data-pick="${key}" data-v="${esc(x.id)}" aria-pressed="${x.id === curId}">${esc(x.name)}</button>`).join('')}</div>`;
  const money = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}${extra}</label><input id="${id}" data-money inputmode="numeric" autocomplete="off" placeholder="0" value="${fmt(val)}"></div>`;

  function draw() {
    const namePh = { fixed: '예: 월세, 통신비, 치지직 구독', install: '예: 자동차 보험, 노트북', saving: '예: 토스 자유적금' }[k];
    form.innerHTML = `
      <div class="field"><label for="r-name">이름</label><input id="r-name" value="${esc(r.name)}" placeholder="${namePh}"></div>
      ${k === 'install' ? `
        <div class="field-row">${money('r-total', '이용금액 (총액)', r.total)}
          <div class="field"><label for="r-months">개월 수</label><input id="r-months" type="number" min="2" max="60" inputmode="numeric" value="${r.months || ''}"></div></div>` : ''}
      ${k === 'saving' ? `
        <div class="field-row"><div class="field"><label for="r-bank">은행</label><input id="r-bank" value="${esc(r.bank || '')}" placeholder="예: 토스뱅크"></div>
          <div class="field"><label for="r-months">목표 개월 <small>선택</small></label><input id="r-months" type="number" min="1" max="120" inputmode="numeric" value="${r.months || ''}"></div></div>` : ''}
      <div class="field-row">
        ${money('r-amount', k === 'saving' ? '매달 납입액' : '매달 금액', r.amount, k === 'install' ? ' <small>수수료 포함</small>' : '')}
        <div class="field"><label for="r-day">매달 며칠 <small>31 = 말일</small></label><input id="r-day" type="number" min="1" max="31" inputmode="numeric" value="${r.day}"></div>
      </div>
      ${k === 'install' && r.total && r.months ? `<p class="hint">총액 ÷ 개월 = ${L.won(Math.ceil(r.total / r.months))}. 수수료가 있으면 매달 금액을 고쳐 주세요. 달마다 다르면 들어간 내역에서 그 달만 고치면 돼요.</p>` : ''}
      ${k === 'saving' ? `<div class="field-row">${money('r-target', '목표 금액', r.target, ' <small>선택</small>')}${money('r-before', '이미 모은 돈', r.paidBefore, ' <small>앱 쓰기 전</small>')}</div>
        ${r.amount && r.months ? `<p class="hint">매달 ${L.won(r.amount)} × ${r.months}개월 = ${L.won(r.amount * r.months)}</p>` : ''}` : ''}
      <div class="field-row">
        <div class="field"><label for="r-start">${k === 'install' ? '첫 납부 달' : '시작 달'}</label><input id="r-start" type="month" value="${esc(r.startYM)}"></div>
        ${k === 'fixed' ? `<div class="field"><label for="r-end">끝나는 달 <small>선택</small></label><input id="r-end" type="month" value="${esc(r.endYM || '')}"></div>` : '<div></div>'}
      </div>
      ${r.startYM < r.fromYM ? `<p class="hint">${L.ymLabel(r.fromYM)}부터 내역에 들어가요. 그 전 달은 이미 따로 적으셨을 테니 넣지 않아요.${k === 'install' ? ` 회차는 ${L.ymLabel(r.startYM)}부터 세요.` : ''}</p>` : ''}
      ${k !== 'saving' ? `<div class="field"><span class="label">분류</span>${chips('cat', opts(cats, r.cat), r.cat)}</div>
        ${r.cat === L.FANDOM ? `<div class="field sub-field"><span class="label">덕질 항목</span>${chips('sub', opts(subs, r.sub), r.sub)}</div>` : ''}` : ''}
      <div class="field"><span class="label">결제수단</span>${chips('pay', opts(pays, r.pay), r.pay)}</div>
      <div class="field"><label for="r-memo">메모 <small>선택</small></label><input id="r-memo" value="${esc(r.memo || '')}"></div>
      ${!isNew ? `<label class="switch-row"><span>잠시 멈추기<small>켜면 자동으로 안 들어가요</small></span><input type="checkbox" class="switch" id="r-paused" ${r.paused ? 'checked' : ''}></label>` : ''}`;
  }
  draw();

  const num = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.money !== undefined) el.value = fmt(num(el.value));
    const v = el.value;
    switch (el.id) {
      case 'r-name': r.name = v; break;
      case 'r-bank': r.bank = v; break;
      case 'r-memo': r.memo = v; break;
      case 'r-amount': r.amount = num(v); amountTouched = true; break;
      case 'r-total': r.total = num(v); break;
      case 'r-months': r.months = Math.max(0, Math.min(120, Number(v) || 0)); break;
      case 'r-day': r.day = Math.max(1, Math.min(31, Number(v) || 1)); break;
      case 'r-target': r.target = num(v); break;
      case 'r-before': r.paidBefore = num(v); break;
      case 'r-start': r.startYM = v; break;
      case 'r-end': r.endYM = v; break;
      default: break;
    }
    if (k === 'install' && !amountTouched && r.total && r.months) {
      r.amount = Math.ceil(r.total / r.months);
      const a = form.querySelector('#r-amount'); if (a) a.value = fmt(r.amount);
    }
  });
  // 계산 안내문은 입력칸을 벗어날 때만 다시 그림 (입력 중 커서 유지)
  form.addEventListener('change', (e) => {
    if (e.target.id === 'r-paused') { r.paused = e.target.checked; return; }
    if (['r-total', 'r-months', 'r-amount', 'r-start'].includes(e.target.id)) {
      setTimeout(() => { // 다음 칸으로 포커스가 옮겨간 뒤 다시 그리고 그 칸에 포커스 돌려줌
        const next = document.activeElement?.id;
        draw();
        if (next) form.querySelector('#' + next)?.focus();
      }, 0);
    }
  });
  form.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pick]');
    if (!p) return;
    r[p.dataset.pick] = p.dataset.v;
    if (p.dataset.pick === 'cat' && r.cat !== L.FANDOM) r.sub = null;
    draw();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const rules = await R.getRules();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${r.name}'을(를) 지울까요? 이미 들어간 내역은 그대로 남아요.`, { ok: '지우기', danger: true }))) return;
      await R.saveRules(rules.filter((x) => x.id !== r.id));
      await s.close(); notifyChange(); toast('지웠어요');
      return;
    }
    if (!r.name.trim()) { toast('이름을 적어주세요'); form.querySelector('#r-name')?.focus(); return; }
    if (!r.amount) { toast('매달 금액을 적어주세요'); return; }
    if (!r.startYM) { toast('시작 달을 골라주세요'); return; }
    if (k === 'install' && (!r.months || r.months < 2)) { toast('개월 수를 적어주세요'); return; }
    if (k !== 'saving' && !r.cat) { toast('분류를 골라주세요'); return; }
    r.name = r.name.trim();
    if (k === 'saving' && !r.target && r.months) r.target = r.amount * r.months;
    if (r.endYM === '') delete r.endYM;
    const next = isNew ? [...rules, r] : rules.map((x) => (x.id === r.id ? r : x));
    await R.saveRules(next);
    const added = await R.runRules();
    await s.close();
    notifyChange();
    toast(added ? `저장했어요 · 내역 ${added}건 자동으로 들어감` : '저장했어요');
  });
}

/* ---------- 월급명세서 ---------- */
export async function openPayslipForm(ym) {
  const [{ pay: payItems, deduct: deductItems }, all] = await Promise.all([R.payItemLists(), R.getPayslips()]);
  const existing = all[ym];
  const prevKey = Object.keys(all).filter((k) => k < ym).sort().pop();
  const base = existing || (prevKey ? all[prevKey] : null);
  const ps = {
    date: existing?.date || (base?.date ? `${ym}-${base.date.slice(8)}` : `${ym}-10`),
    pay: { ...(base?.pay || {}) }, deduct: { ...(base?.deduct || {}) }, memo: existing?.memo || '',
  };
  const s = openSheet({
    title: `${L.ymLabel(ym)} 월급명세서`,
    body: '<form class="form payslip-form" novalidate></form>',
    footer: `${existing ? `<button type="button" class="btn btn-danger-ghost" data-act="del" aria-label="삭제">${icon('trash')}</button>` : ''}<span class="ps-foot-net"></span><button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const form = s.body.firstElementChild;
  const fmt = (n) => (n ? Number(n).toLocaleString('ko-KR') : '');
  const footNet = s.foot.querySelector('.ps-foot-net');
  const drawFootNet = () => { footNet.innerHTML = `<small>실수령액</small><b>${L.won(R.payslipTotals(ps).net)}</b>`; };
  drawFootNet();
  // 숨긴 항목이라도 값이 있으면 보이게
  const rows = (list, group) => list.filter((x) => !x.hidden || ps[group][x.id]).map((x) => `<div class="budget-row"><label for="ps-${x.id}">${esc(x.name)}</label>
    <input id="ps-${x.id}" data-group="${group}" data-item="${esc(x.id)}" inputmode="numeric" autocomplete="off" placeholder="0" value="${fmt(ps[group][x.id])}"></div>`).join('');
  const totalsHTML = () => { const t = R.payslipTotals(ps); return `<dt>지급액 계</dt><dd>${L.won(t.pay)}</dd><dt>공제액 계</dt><dd>− ${L.won(t.deduct)}</dd><dt class="total">실수령액</dt><dd class="total">${L.won(t.net)}</dd>`; };

  form.innerHTML = `
    ${!existing && base ? `<p class="hint notice">${L.ymLabel(prevKey)} 명세서 값을 불러왔어요. 바뀐 것만 고쳐 주세요.</p>` : ''}
    <div class="field-row"><div class="field"><label for="ps-date">지급일</label><input id="ps-date" type="date" value="${esc(ps.date)}"></div><div></div></div>
    <section class="budget-group"><h3>지급 항목 <button type="button" class="btn-link" data-edit="payItems">항목 편집</button></h3>${rows(payItems, 'pay')}</section>
    <section class="budget-group"><h3>공제 항목 <button type="button" class="btn-link" data-edit="deductItems">항목 편집</button></h3>${rows(deductItems, 'deduct')}</section>
    <dl class="flow ps-totals">${totalsHTML()}</dl>
    <div class="field"><label for="ps-memo">메모 <small>선택</small></label><input id="ps-memo" value="${esc(ps.memo)}"></div>
    <p class="hint">저장하면 실수령액이 '${Number(ym.slice(5))}월 급여 (월급명세서)' 수입으로 들어가요.</p>`;

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'ps-date') { ps.date = el.value; return; }
    if (el.id === 'ps-memo') { ps.memo = el.value; return; }
    if (!el.dataset.group) return;
    const n = Number(el.value.replace(/[^\d]/g, '')) || 0;
    el.value = fmt(n);
    if (n) ps[el.dataset.group][el.dataset.item] = n; else delete ps[el.dataset.group][el.dataset.item];
    form.querySelector('.ps-totals').innerHTML = totalsHTML();
    drawFootNet();
  });
  form.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (!ed) return;
    await openListManager(ed.dataset.edit);
    toast('항목을 바꿨으면 명세서를 다시 열어 주세요');
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`${L.ymLabel(ym)} 명세서와 그 급여 수입 내역을 지울까요?`, { ok: '지우기', danger: true }))) return;
      await R.deletePayslip(ym);
      await s.close(); notifyChange(); toast('지웠어요');
      return;
    }
    if (!ps.date || !ps.date.startsWith(ym)) { toast(`지급일은 ${L.ymLabel(ym)} 안의 날짜로 골라주세요`); return; }
    if (!R.payslipTotals(ps).pay) { toast('지급 항목을 적어주세요'); return; }
    await R.savePayslip(ym, ps);
    await s.close();
    notifyChange();
    toast(`저장했어요 · 실수령액 ${L.won(R.payslipTotals(ps).net)} 수입으로 들어감`);
  });
}
