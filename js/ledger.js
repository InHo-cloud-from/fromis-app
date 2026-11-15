// 가계부 탭: 월별 요약 / 내역 / 입력 (지출·수입·카드값 납부)
import { DB, requestPersist } from './db.js';
import { icon, esc, uid, openSheet, toast, confirmSheet, today } from './ui.js';
import { MEMBERS } from './data.js';
import * as L from './ledger-data.js';
import { openSettings } from './settings.js';
import { openBudgetEditor } from './ledger-settings.js';
import * as P from './photos.js';
import { avatarHTML, openBannerManager } from './decor-settings.js';
import * as R from './ledger-rec.js';
import { manageHTML, recSummaryHTML, openRuleForm, openPayslipForm } from './ledger-manage.js';
import * as F from './ledger-fandom.js';
import * as S from './schedule-data.js';

let mphotos = {}; // 멤버 프로필 사진 (render 때 갱신)

const TYPES = { expense: '지출', income: '수입', cardpay: '카드값 납부' };
const WD = ['일', '월', '화', '수', '목', '금', '토'];

const state = { ym: today().slice(0, 7), view: 'summary', scope: 'all' };
try {
  const v = localStorage.getItem('ledger.view'); if (v) state.view = v;
  const s = localStorage.getItem('ledger.scope'); if (s) state.scope = s;
} catch { /* 무시 */ }
const remember = () => { try { localStorage.setItem('ledger.view', state.view); localStorage.setItem('ledger.scope', state.scope); } catch { /* 무시 */ } };

let box = null;
const onData = () => render();

export function mount(view) {
  box = document.createElement('div');
  box.className = 'ledger';
  view.append(box);
  box.addEventListener('click', onClick);
  window.addEventListener('data-changed', onData);
  render();
}
export function unmount() {
  window.removeEventListener('data-changed', onData);
  box = null;
}

async function load() {
  await R.runRules(); // 정한 날 지난 고정지출·할부·적금을 내역으로
  const [allTx, rules, payslips, applies, wishes] = await Promise.all([DB.all('tx'), R.getRules(), R.getPayslips(), F.getApplies(), F.getWishes()]);
  const [txs, cats, subs, pays, kinds, bstore, banner, mphotos, layout, fit, dday] = await Promise.all([
    L.txOfMonth(state.ym), L.getList('cats'), L.getList('subs'), L.getList('pays'), L.getList('incomeKinds'), L.getBudgetStore(),
    P.pickBanner(), P.memberPhotos(), P.getLayout(), P.getFit(), S.nextDday(),
  ]);
  return { txs, allTx, rules, payslips, applies, wishes, dday, cats, subs, pays, kinds, banner, mphotos, layout, fit, budget: L.budgetFor(bstore, state.ym) };
}

// 상단: 배너 사진이 있으면 사진 위에 이번 달 남은 예산, 없으면 기본 제목
function headHTML(d) {
  const gear = `<button type="button" class="icon-btn" data-act="settings" aria-label="설정">${icon('gear')}</button>`;
  if (!d.banner) {
    return `<header class="page-head">
      <div><p class="eyebrow">fromis_9</p><h1>가계부</h1></div>
      <div class="head-actions"><button type="button" class="btn-link" data-act="banner">${icon('image')} 사진 넣기</button>${gear}</div>
    </header>`;
  }
  const s = L.summarize(d.txs, d.pays);
  const fandom = state.scope === 'fandom';
  const budget = fandom ? d.budget.cats?.[L.FANDOM] : d.budget.total;
  const spent = fandom ? s.fandom : s.expense;
  const month = `${Number(state.ym.slice(5))}월`;
  const num = budget ? budget - spent : spent;
  const what = `${month} ${fandom ? '덕질 ' : ''}`;
  const label = !budget ? `${what}지출` : num < 0 ? `${what}예산` : `${what}남은 예산`;
  const big = budget && num < 0 ? `${L.won(-num)} 초과` : L.won(num);
  const sub = budget ? `${what}지출 ${L.won(spent)}` : '';
  const bd = P.birthdayToday();
  const bdTag = bd ? `<span class="hero-bd">오늘은 ${esc(bd)} 생일이에요</span>` : '';
  const url = P.photoURL(d.banner);
  const img = `<img src="${url}" alt="" class="hero-img">`;
  // 전체 보이기: 뒤에 같은 사진을 흐리게 깔고 앞에 사진 전체
  const bg = `<div class="hero-bg" style="background-image:url(${url})" aria-hidden="true"></div>`;
  const now = new Date();
  const dateLine = `${now.getMonth() + 1}월 ${now.getDate()}일 ${WD[now.getDay()]}요일`;
  const tapHint = 'title="누르면 다음 사진"';

  if (d.layout === 'polaroid') {
    return `<header class="page-head">
        <div><p class="eyebrow">fromis_9</p><h1>가계부</h1></div>${gear}
      </header>
      <section class="polaroid-row">
        <button type="button" class="polaroid" data-act="nextphoto" ${tapHint} aria-label="다음 사진">
          ${img}<span class="polaroid-cap">${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}${d.banner.member ? ' · ' + esc(d.banner.member) : ''}</span>
        </button>
        <div class="polaroid-text">
          ${bdTag}
          <p class="hero-label">${label}</p>
          <b class="polaroid-num${budget && num < 0 ? ' neg' : ''}">${big}</b>
          ${sub ? `<p class="hint">${sub}</p>` : ''}
        </div>
      </section>`;
  }
  if (d.layout === 'banner') {
    return `<header class="hero banner fit-${d.fit}">
      ${bg}
      <button type="button" class="hero-tap" data-act="nextphoto" ${tapHint} aria-label="다음 사진">${img}</button>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-top"><p class="eyebrow">fromis_9</p>${gear}</div>
      <div class="hero-bottom">${bdTag}<h1>가계부</h1><p class="hero-label">${label}</p><b class="hero-num">${big}</b></div>
    </header>`;
  }
  // 잠금화면: 사진이 화면 대부분, 날짜 아래 큰 숫자 (시계 자리)
  return `<header class="hero lock fit-${d.fit}">
    ${bg}
    <button type="button" class="hero-tap" data-act="nextphoto" ${tapHint} aria-label="다음 사진">${img}</button>
    <div class="hero-shade" aria-hidden="true"></div>
    <div class="hero-top"><p class="eyebrow">fromis_9 · 가계부</p>${gear}</div>
    <div class="lock-clock">
      <p class="lock-date">${dateLine}</p>
      <b class="lock-num">${big}</b>
      <p class="hero-label">${label}</p>
    </div>
    <div class="lock-bottom">${bdTag}${d.dday ? `<button type="button" class="lock-dday" data-act="gotoschedule"><b>${S.dText(d.dday.d)}</b> ${esc(d.dday.title)}</button>` : ''}${sub ? `<p>${sub}</p>` : ''}<span class="lock-more" aria-hidden="true">${icon('chevron', 'down')}</span></div>
  </header>`;
}

async function render() {
  if (!box) return;
  const d = await load();
  if (!box) return;
  mphotos = d.mphotos;
  box.className = `ledger layout-${d.banner ? d.layout : 'plain'}${P.isWide(d.banner) ? ' photo-wide' : ''}`;
  const isThisMonth = state.ym === today().slice(0, 7);
  fixView();
  box.innerHTML = `
    ${headHTML(d)}
    <div class="ledger-bar">
      <div class="month-nav">
        <button type="button" class="icon-btn sm" data-act="prev" aria-label="이전 달">${icon('chevron', 'flip')}</button>
        <h2>${L.ymLabel(state.ym)}</h2>
        <button type="button" class="icon-btn sm" data-act="next" aria-label="다음 달">${icon('chevron')}</button>
        ${isThisMonth ? '' : '<button type="button" class="btn-link" data-act="thismonth">이번 달</button>'}
      </div>
      <div class="ledger-filters">
        <div class="seg seg-sm" role="group" aria-label="보기">
          <button type="button" data-view="summary" aria-pressed="${state.view === 'summary'}">요약</button>
          <button type="button" data-view="list" aria-pressed="${state.view === 'list'}">내역</button>
          ${state.scope === 'fandom'
    ? `<button type="button" data-view="fandom" aria-pressed="${state.view === 'fandom'}">응모·위시</button>`
    : `<button type="button" data-view="manage" aria-pressed="${state.view === 'manage'}">관리</button>`}
        </div>
        <div class="seg seg-sm" role="group" aria-label="범위">
          <button type="button" data-scope="all" aria-pressed="${state.scope === 'all'}">전체</button>
          <button type="button" data-scope="fandom" aria-pressed="${state.scope === 'fandom'}">덕질만</button>
        </div>
      </div>
    </div>
    <div class="ledger-body">${bodyHTML(d)}</div>
    <button type="button" class="fab" data-act="add" aria-label="내역 추가">${icon('plus')}</button>`;

  // 크기 정보가 없는 예전 사진: 불러온 뒤 가로/세로 판단해서 저장
  const b = d.banner;
  const im = box.querySelector('.hero-img');
  if (b && !b.w && im) {
    im.addEventListener('load', () => {
      const w = im.naturalWidth, h = im.naturalHeight;
      if (!w || !h) return;
      P.updatePhoto(b, { w, h });
      b.w = w; b.h = h;
      box?.classList.toggle('photo-wide', P.isWide(b));
    }, { once: true });
  }
}

// '관리'는 전체 보기에만, '응모·위시'는 덕질만 보기에만 → 범위를 바꾸면 짝이 되는 탭으로
function fixView() {
  if (state.view === 'manage' && state.scope === 'fandom') state.view = 'fandom';
  else if (state.view === 'fandom' && state.scope !== 'fandom') state.view = 'manage';
}

function bodyHTML(d) {
  if (state.view === 'manage') return manageHTML(d, state.ym);
  if (state.view === 'fandom') {
    return F.fandomHTML({ ...d, budget: d.budget.cats?.[L.FANDOM], fandomSpent: L.summarize(d.txs, d.pays).fandom });
  }
  if (state.view === 'list') return listHTML(d);
  return summaryHTML(d);
}

/* ---------- 요약 ---------- */
function meter(spent, budget, label) {
  if (!budget) return '';
  const over = spent > budget;
  const pct = Math.round((spent / budget) * 100);
  return `<div class="meter${over ? ' over' : ''}" role="meter" aria-label="${esc(label)} 예산 사용" aria-valuemin="0" aria-valuemax="${budget}" aria-valuenow="${Math.min(spent, budget)}" title="${esc(label)}: ${L.won(spent)} / ${L.won(budget)}">
      <span style="width:${Math.min(pct, 100)}%"></span></div>
    <div class="meter-cap"><span>${pct}% 사용 · 예산 ${L.won(budget)}</span>
      <b class="${over ? 'neg' : ''}">${over ? `${L.won(spent - budget)} 초과` : `${L.won(budget - spent)} 남음`}</b></div>`;
}

function rowsHTML(items) {
  if (!items.length) return '<p class="hint pad">이번 달 지출이 없어요.</p>';
  return `<ul class="cat-rows">${items.map((it) => `
    <li class="${it.sub ? 'is-sub' : ''}">
      <div class="cr-top"><span>${esc(it.name)}</span><b>${L.won(it.spent)}</b></div>
      ${meter(it.spent, it.budget, it.name)}
    </li>`).join('')}</ul>`;
}

function summaryHTML({ txs, allTx, rules, cats, subs, pays, budget, applies, wishes }) {
  const s = L.summarize(txs, pays);
  const b = budget.cats || {};
  const budgetBtn = `<button type="button" class="btn-link" data-act="budget">${icon('gear')} 예산${budget.custom ? ' (이번 달만)' : ''}</button>`;

  if (state.scope === 'fandom') {
    const fb = b[L.FANDOM];
    const subItems = L.visible(subs).map((x) => ({ name: x.name, spent: s.bySub[x.id] || 0, budget: b['sub:' + x.id] }))
      .concat(subs.filter((x) => x.hidden && s.bySub[x.id]).map((x) => ({ name: x.name, spent: s.bySub[x.id], budget: null })));
    const noSub = s.fandom - Object.values(s.bySub).reduce((a, n) => a + n, 0);
    if (noSub > 0) subItems.push({ name: '항목 없음', spent: noSub });
    const shown = subItems.filter((x) => x.spent || x.budget).sort((x, y) => y.spent - x.spent);
    return `
      <section class="stats">
        <div class="stat"><span>덕질 지출</span><b>${L.won(s.fandom)}</b></div>
        <div class="stat"><span>전체 지출 중</span><b>${s.expense ? Math.round((s.fandom / s.expense) * 100) : 0}%</b></div>
        <div class="stat"><span>건수</span><b>${txs.filter((t) => t.type === 'expense' && t.cat === L.FANDOM).length}건</b></div>
      </section>
      <div class="ledger-grid">
        <section class="panel">
          <div class="panel-head"><h3>덕질 예산</h3>${budgetBtn}</div>
          ${fb ? meter(s.fandom, fb, '덕질') : '<p class="hint">덕질 예산을 정하면 얼마나 남았는지 보여줘요.</p>'}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>멤버별 지출</h3></div>
          ${memberBars(s.byMember)}
        </section>
        ${F.fandomMiniHTML({ applies, wishes })}
        <section class="panel span-2">
          <div class="panel-head"><h3>항목별</h3></div>
          ${rowsHTML(shown)}
        </section>
      </div>`;
  }

  const catItems = cats.filter((c) => !c.hidden || s.byCat[c.id])
    .map((c) => ({ name: c.name, spent: s.byCat[c.id] || 0, budget: b[c.id] }))
    .filter((x) => x.spent || x.budget)
    .sort((x, y) => y.spent - x.spent);
  const left = s.income - s.expense;
  const cashLeft = s.income - s.cashExpense - s.cardPay;
  return `
    <section class="stats">
      <div class="stat"><span>수입</span><b>${L.won(s.income)}</b></div>
      <div class="stat"><span>지출</span><b>${L.won(s.expense)}</b></div>
      <div class="stat"><span>수입 − 지출</span><b class="${left < 0 ? 'neg' : ''}">${L.won(left)}</b></div>
    </section>
    <div class="ledger-grid">
      <section class="panel">
        <div class="panel-head"><h3>이번 달 예산</h3>${budgetBtn}</div>
        ${budget.total ? meter(s.expense, budget.total, '전체') : '<p class="hint">월 예산을 정하면 남은 돈을 보여줘요.</p>'}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>현금 흐름</h3><small class="panel-note">카드 사용분 제외</small></div>
        <dl class="flow">
          <dt>수입</dt><dd>${L.won(s.income)}</dd>
          <dt>현금·계좌 지출</dt><dd>− ${L.won(s.cashExpense)}</dd>
          <dt>카드값 납부</dt><dd>− ${L.won(s.cardPay)}</dd>
          <dt class="total">남은 현금</dt><dd class="total ${cashLeft < 0 ? 'neg' : ''}">${L.won(cashLeft)}</dd>
          <dt class="ref">이번 달 카드 사용 (청구 전)</dt><dd class="ref">${L.won(s.cardUse)}</dd>
        </dl>
      </section>
      ${recSummaryHTML({ rules, txs, allTx })}
      <section class="panel span-2">
        <div class="panel-head"><h3>분류별 지출</h3></div>
        ${rowsHTML(catItems)}
      </section>
    </div>`;
}

function memberBars(byMember) {
  const rows = MEMBERS.map((m) => ({ name: m, v: byMember[m] || 0 }));
  if (byMember['']) rows.push({ name: '멤버 없음', v: byMember[''], muted: true });
  const max = Math.max(...rows.map((r) => r.v));
  if (!max) return '<p class="hint">덕질 지출을 입력할 때 멤버를 고르면 여기 모여요.</p>';
  return `<ul class="bars">${rows.map((r) => `
    <li title="${esc(r.name)}: ${L.won(r.v)}"${r.muted ? ' class="muted"' : ''}>
      <span class="bar-name">${r.muted ? '' : avatarHTML(r.name, mphotos[r.name])}${esc(r.name)}</span>
      <span class="bar-track"><span style="width:${(r.v / max) * 100}%"></span></span>
      <b>${L.won(r.v)}</b>
    </li>`).join('')}</ul>`;
}

/* ---------- 내역 ---------- */
function listHTML({ txs, cats, subs, pays, kinds }) {
  let rows = txs;
  if (state.scope === 'fandom') rows = rows.filter((t) => t.type === 'expense' && t.cat === L.FANDOM);
  if (!rows.length) {
    return `<div class="empty"><div class="empty-ic">${icon('wallet')}</div><p>${L.ymLabel(state.ym)} 내역이 없어요</p><small>오른쪽 아래 + 버튼으로 추가해요.</small></div>`;
  }
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const days = new Map();
  for (const t of rows) { if (!days.has(t.date)) days.set(t.date, []); days.get(t.date).push(t); }
  return [...days].map(([date, list]) => {
    const dt = new Date(date + 'T00:00');
    const out = list.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    return `<section class="day">
      <h3><span>${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WD[dt.getDay()]})</span>${out ? `<small>지출 ${L.won(out)}</small>` : ''}</h3>
      <ul>${list.map((t) => txRow(t, { cats, subs, pays, kinds })).join('')}</ul>
    </section>`;
  }).join('');
}

function txRow(t, { cats, subs, pays, kinds }) {
  let title, meta, amt, cls;
  const pay = L.nameOf(pays, t.pay);
  if (t.type === 'income') {
    title = t.place || L.nameOf(kinds, t.kind, '수입');
    meta = [L.nameOf(kinds, t.kind), t.memo].filter(Boolean);
    amt = `+${L.won(t.amount)}`; cls = 'income';
  } else if (t.type === 'cardpay') {
    const card = L.nameOf(pays, t.card, '카드');
    title = card.endsWith('카드') ? `${card}값 납부` : `${card} 카드값 납부`;
    meta = ['지출 합계에는 안 들어가요', t.memo].filter(Boolean);
    amt = L.won(t.amount); cls = 'cardpay';
  } else {
    const cat = L.nameOf(cats, t.cat, '분류 없음');
    title = t.place || (t.cat === L.FANDOM && t.sub ? L.nameOf(subs, t.sub) : cat);
    meta = [t.cat === L.FANDOM ? ['덕질', L.nameOf(subs, t.sub)].filter(Boolean).join(' · ') : cat, t.member, pay, t.memo].filter(Boolean);
    amt = `−${L.won(t.amount)}`; cls = t.cat === L.FANDOM ? 'expense fandom' : 'expense';
  }
  const tag = t.rec?.payslip ? '명세서' : t.rec?.apply ? '응모' : t.rec?.id ? '자동' : '';
  return `<li><button type="button" class="tx-row" data-edit="${esc(t.id)}">
    <span class="tx-dot ${cls}" aria-hidden="true"></span>
    <span class="tx-main"><b>${tag ? `<span class="tx-tag">${tag}</span>` : ''}${esc(title)}</b><small>${esc(meta.join(' · '))}</small></span>
    <span class="tx-amt ${cls}">${esc(amt)}</span>
  </button></li>`;
}

/* ---------- 클릭 ---------- */
async function onClick(e) {
  const v = e.target.closest('[data-view]');
  if (v) { state.view = v.dataset.view; remember(); render(); return; }
  const sc = e.target.closest('[data-scope]');
  if (sc) { state.scope = sc.dataset.scope; remember(); render(); return; }
  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const t = await DB.get('tx', ed.dataset.edit);
    if (t?.rec?.payslip) openPayslipForm(t.rec.payslip); // 명세서로 만든 급여는 명세서에서 고침
    else if (t?.rec?.apply) F.openApplyForm(t.rec.apply); // 응모 지출은 응모 기록에서 고침
    else if (t) openTxForm(t);
    return;
  }
  if (e.target.closest('[data-addapply]')) { F.openApplyForm(null); return; }
  const ap = e.target.closest('[data-apply]');
  if (ap) { F.openApplyForm(ap.dataset.apply); return; }
  if (e.target.closest('[data-addwish]')) { F.openWishForm(null); return; }
  const bo = e.target.closest('[data-bought]');
  if (bo) {
    const w = (await F.getWishes()).find((x) => x.id === bo.dataset.bought);
    if (w) openTxForm(null, { prefill: F.wishToPrefill(w), onSaved: (tx) => F.markWishBought(w.id, tx), title: `'${w.name}' 샀어요` });
    return;
  }
  const wi = e.target.closest('[data-wish]');
  if (wi) { F.openWishForm(wi.dataset.wish); return; }
  const ar = e.target.closest('[data-addrule]');
  if (ar) { openRuleForm(ar.dataset.addrule, null); return; }
  const ru = e.target.closest('[data-rule]');
  if (ru) { const r = (await R.getRules()).find((x) => x.id === ru.dataset.rule); if (r) openRuleForm(r.kind, r); return; }
  const ps = e.target.closest('[data-payslip]');
  if (ps) { openPayslipForm(ps.dataset.payslip); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'prev') { state.ym = L.shiftYM(state.ym, -1); render(); }
  if (act === 'next') { state.ym = L.shiftYM(state.ym, 1); render(); }
  if (act === 'thismonth') { state.ym = today().slice(0, 7); render(); }
  if (act === 'settings') openSettings();
  if (act === 'banner') openBannerManager();
  if (act === 'nextphoto') { await P.nextBanner(); render(); }
  if (act === 'gotoschedule') window.dispatchEvent(new CustomEvent('goto-tab', { detail: 'schedule' }));
  if (act === 'budget') openBudgetEditor(state.ym);
  if (act === 'add') openTxForm(null);
}

/* ---------- 입력 폼 ---------- */
function defaultDate() {
  // 보고 있는 달이 이번 달이 아니면 그 달 1일로
  const t = today();
  return t.startsWith(state.ym) ? t : `${state.ym}-01`;
}
const lastPay = () => { try { return localStorage.getItem('ledger.lastPay'); } catch { return null; } };

// opts.prefill: 새 내역에 미리 채울 값 (위시 '샀어요'), opts.onSaved(tx): 저장 후 할 일
async function openTxForm(tx, opts = {}) {
  const [cats, subs, pays, kinds] = await Promise.all([L.getList('cats'), L.getList('subs'), L.getList('pays'), L.getList('incomeKinds')]);
  const isNew = !tx;
  const f = tx ? { ...tx } : {
    id: uid(), type: 'expense', date: today(), amount: 0,
    cat: state.scope === 'fandom' ? L.FANDOM : null, sub: null, member: null, place: '', memo: '',
    pay: lastPay() || L.visible(pays)[0]?.id || null, kind: L.visible(kinds)[0]?.id || null,
    card: L.visible(pays).find((p) => p.card)?.id || null,
    ...(opts.prefill || {}),
  };
  if (!tx && !opts.prefill) f.date = defaultDate();

  const s = openSheet({
    title: opts.title || (isNew ? '내역 추가' : '내역 수정'),
    body: '<form class="form tx-form" novalidate></form>',
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const form = s.body.firstElementChild;

  // 숨긴 항목이라도 이 내역이 쓰고 있으면 보이게
  const shown = (list, cur) => list.filter((x) => !x.hidden || x.id === cur);
  const chips = (key, list, cur, { none } = {}) => `<div class="chips wrap" role="group">
    ${none ? `<button type="button" class="chip chip-sm" data-pick="${key}" data-v="" aria-pressed="${!cur}">${esc(none)}</button>` : ''}
    ${list.map((x) => `<button type="button" class="chip chip-sm" data-pick="${key}" data-v="${esc(x.id)}" aria-pressed="${x.id === cur}">${esc(x.name)}</button>`).join('')}
  </div>`;

  function draw() {
    const t = f.type;
    const cardList = shown(pays, f.card).filter((p) => p.card);
    form.innerHTML = `
      ${isNew ? `<div class="seg" role="group" aria-label="종류">${Object.entries(TYPES).map(([k, n]) => `<button type="button" data-type="${k}" aria-pressed="${t === k}">${n}</button>`).join('')}</div>` : `<p class="hint">${TYPES[t]}</p>`}
      <div class="field-row">
        <div class="field"><label for="tx-amt">금액</label><input id="tx-amt" inputmode="numeric" autocomplete="off" placeholder="0" value="${f.amount ? f.amount.toLocaleString('ko-KR') : ''}"></div>
        <div class="field"><label for="tx-date">날짜</label><input id="tx-date" type="date" value="${esc(f.date)}"></div>
      </div>
      ${t === 'expense' ? `
        <div class="field"><span class="label">분류</span>${chips('cat', shown(cats, f.cat), f.cat)}</div>
        ${f.cat === L.FANDOM ? `
          <div class="field sub-field"><span class="label">덕질 항목</span>${chips('sub', shown(subs, f.sub), f.sub)}</div>
          <div class="field sub-field"><span class="label">멤버 <small>선택</small></span>
            <div class="chips wrap" role="group">
              <button type="button" class="chip chip-sm" data-pick="member" data-v="" aria-pressed="${!f.member}">없음</button>
              ${MEMBERS.map((m) => `<button type="button" class="chip chip-sm chip-avatar" data-pick="member" data-v="${esc(m)}" aria-pressed="${f.member === m}">${avatarHTML(m, mphotos[m], 'sm')}${esc(m)}</button>`).join('')}
            </div></div>` : ''}
        <div class="field"><label for="tx-place">사용처 · 내용</label><input id="tx-place" value="${esc(f.place)}" placeholder="예: 세븐일레븐, 응원봉"></div>
        <div class="field"><span class="label">결제수단</span>${chips('pay', shown(pays, f.pay), f.pay)}</div>` : ''}
      ${t === 'income' ? `
        <div class="field"><span class="label">구분</span>${chips('kind', shown(kinds, f.kind), f.kind)}</div>
        <div class="field"><label for="tx-place">출처</label><input id="tx-place" value="${esc(f.place)}" placeholder="예: 회사 11월 급여"></div>` : ''}
      ${t === 'cardpay' ? `
        <p class="hint">카드로 쓴 돈은 쓴 날 이미 지출로 잡혀요. 카드값 납부는 지출 합계에 넣지 않고 '현금 흐름'에서만 빠져요.</p>
        <div class="field"><span class="label">어떤 카드</span>${cardList.length ? chips('card', cardList, f.card) : '<p class="hint">설정 › 결제수단에서 카드를 먼저 추가해 주세요.</p>'}</div>` : ''}
      <div class="field"><label for="tx-memo">메모 <small>선택</small></label><input id="tx-memo" value="${esc(f.memo)}"></div>`;
  }
  draw();

  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'tx-amt') {
      f.amount = L.parseWon(e.target.value);
      e.target.value = f.amount ? f.amount.toLocaleString('ko-KR') : '';
    }
    if (id === 'tx-date') f.date = e.target.value;
    if (id === 'tx-place') f.place = e.target.value;
    if (id === 'tx-memo') f.memo = e.target.value;
  });
  form.addEventListener('click', (e) => {
    const ty = e.target.closest('[data-type]');
    if (ty) { f.type = ty.dataset.type; draw(); return; }
    const p = e.target.closest('[data-pick]');
    if (!p) return;
    const k = p.dataset.pick;
    f[k] = p.dataset.v || null;
    if (k === 'cat' && f.cat !== L.FANDOM) { f.sub = null; f.member = null; }
    draw();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet('이 내역을 삭제할까요?', { ok: '삭제', danger: true }))) return;
      await DB.del('tx', f.id);
      if (f.rec?.id) await R.skipRuleMonth(f.rec); // 자동 내역을 지우면 그 달은 다시 안 만듦
      await s.close();
      toast('삭제했어요');
      render();
      return;
    }
    if (!f.amount) { toast('금액을 적어주세요'); form.querySelector('#tx-amt')?.focus(); return; }
    if (!f.date) { toast('날짜를 골라주세요'); return; }
    if (f.type === 'expense' && !f.cat) { toast('분류를 골라주세요'); return; }
    if (f.type === 'cardpay' && !f.card) { toast('카드를 골라주세요'); return; }
    const keep = { expense: ['cat', 'sub', 'member', 'place', 'pay'], income: ['kind', 'place'], cardpay: ['card'] }[f.type];
    const out = { id: f.id, type: f.type, date: f.date, amount: f.amount, memo: f.memo.trim(), createdAt: f.createdAt || Date.now(), updatedAt: Date.now() };
    for (const k of keep) out[k] = typeof f[k] === 'string' ? f[k].trim() || null : f[k] ?? null;
    if (f.rec) out.rec = f.rec; // 자동 내역 표시 유지 (안 그러면 같은 달에 또 만들어짐)
    await DB.put('tx', out);
    requestPersist();
    if (out.type === 'expense' && out.pay) { try { localStorage.setItem('ledger.lastPay', out.pay); } catch { /* 무시 */ } }
    if (opts.onSaved) await opts.onSaved(out);
    await s.close();
    toast(opts.onSaved ? '지출에 넣었어요' : isNew ? '저장했어요' : '수정했어요');
    if (L.ymOf(out.date) !== state.ym) state.ym = L.ymOf(out.date);
    render();
  });

  if (isNew) setTimeout(() => form.querySelector('#tx-amt')?.focus(), 320);
}
