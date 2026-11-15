// 가계부 2단계 데이터: 고정지출·할부·적금(자동 입력 규칙)과 월급명세서
import { DB } from './db.js';
import { uid, today } from './ui.js';
import { getList, shiftYM, FANDOM } from './ledger-data.js';

/* ---------- 자동 입력 규칙 ----------
   meta 'ledger.rules' = [{
     id, kind: 'fixed' | 'install' | 'saving', name, amount(매달), day(1~31, 31=말일),
     cat, sub, member, pay, memo, startYM, endYM, fromYM(만든 달: 이 달 전으로는 소급 안 함), skip: [ym...],
     install: total(이용금액), months
     saving: bank, target(목표 금액), months(목표 개월), paidBefore(앱 쓰기 전 모은 돈)
   }]
   만들어진 내역에는 rec: { id, ym } 표시 → 같은 달에 두 번 안 만들고, 지운 달은 skip에 넣어 다시 안 만듦 */
export const RULE_KINDS = { fixed: '고정지출', install: '할부', saving: '적금' };

export async function getRules() { return (await DB.getMeta('ledger.rules')) || []; }
export const saveRules = (r) => DB.setMeta('ledger.rules', r);

export const ymDiff = (a, b) => { // b - a (개월)
  const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
};
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const dueDate = (r, ym) => `${ym}-${String(Math.min(r.day || 1, lastDay(ym))).padStart(2, '0')}`;

// 할부·적금: ym이 몇 회차인지 (1부터). 범위 밖이면 0
export function roundOf(r, ym) {
  const n = ymDiff(r.startYM, ym) + 1;
  if (n < 1) return 0;
  if ((r.kind === 'install' || r.kind === 'saving') && r.months && n > r.months) return 0;
  if (r.endYM && ym > r.endYM) return 0;
  return n;
}

function txFromRule(r, ym) {
  const n = roundOf(r, ym);
  const memo = r.kind === 'install' ? `할부 ${n}/${r.months}${r.memo ? ' · ' + r.memo : ''}`
    : r.kind === 'saving' ? `${n}회차${r.months ? '/' + r.months : ''}${r.memo ? ' · ' + r.memo : ''}` : (r.memo || '');
  return {
    id: uid(), type: 'expense', date: dueDate(r, ym), amount: r.amount,
    cat: r.kind === 'saving' ? 'c-saving' : r.cat, sub: r.cat === FANDOM ? r.sub || null : null, member: r.cat === FANDOM ? r.member || null : null,
    place: r.name, pay: r.pay || null, memo, rec: { id: r.id, ym }, createdAt: Date.now(), updatedAt: Date.now(),
  };
}

// 정한 날이 지난 규칙을 내역으로 만들기. 앱을 열 때·규칙 바꿀 때마다 불러도 중복 없음
let running = null;
export function runRules() {
  if (!running) running = doRun().finally(() => { running = null; });
  return running;
}
async function doRun() {
  const rules = await getRules();
  if (!rules.length) return 0;
  const t = today();
  const cur = t.slice(0, 7);
  const have = new Set((await DB.all('tx')).filter((x) => x.rec?.id).map((x) => `${x.rec.id}|${x.rec.ym}`));
  let added = 0;
  for (const r of rules) {
    if (r.paused) continue;
    let ym = r.fromYM > r.startYM ? r.fromYM : r.startYM;
    for (let guard = 0; ym <= cur && guard < 120; guard++, ym = shiftYM(ym, 1)) {
      if (!roundOf(r, ym)) break; // 끝난 할부·적금·고정지출
      if (dueDate(r, ym) > t || have.has(`${r.id}|${ym}`) || (r.skip || []).includes(ym)) continue;
      await DB.put('tx', txFromRule(r, ym));
      have.add(`${r.id}|${ym}`);
      added++;
    }
  }
  return added;
}

// 자동으로 만든 내역을 지우면 그 달은 다시 안 만들도록
export async function skipRuleMonth(rec) {
  if (!rec?.id) return;
  const rules = await getRules();
  const r = rules.find((x) => x.id === rec.id);
  if (!r) return;
  r.skip = [...new Set([...(r.skip || []), rec.ym])];
  await saveRules(rules);
}

// 진행 상황 (관리 화면·요약용)
export function ruleStatus(r, txs, ym = today().slice(0, 7)) {
  const mine = txs.filter((x) => x.rec?.id === r.id);
  const paidSum = mine.reduce((a, x) => a + x.amount, 0);
  const t = today();
  if (r.kind === 'install') {
    const n = ymDiff(r.startYM, ym) + 1;
    const done = Math.max(0, Math.min(r.months, dueDate(r, ym) <= t ? n : n - 1));
    return { done, left: r.months - done, leftAmount: Math.max(0, (r.months - done) * r.amount), finished: done >= r.months };
  }
  if (r.kind === 'saving') {
    const saved = (r.paidBefore || 0) + paidSum;
    return { saved, target: r.target || 0, pct: r.target ? saved / r.target : 0, count: mine.length };
  }
  return { thisMonth: mine.find((x) => x.rec.ym === ym) || null };
}

/* ---------- 월급명세서 ----------
   항목 목록: meta 'ledger.payItems' / 'ledger.deductItems' (편집 가능, 기본값은 쓰던 시트의 항목 이름)
   명세서: meta 'ledger.payslips' = { 'YYYY-MM': { date, pay: {항목id: 금액}, deduct: {...}, memo } }
   저장하면 실수령액이 수입 내역(id 'payslip-YYYY-MM')으로 들어감 */

export async function getPayslips() { return (await DB.getMeta('ledger.payslips')) || {}; }
export const payslipTotals = (ps) => {
  const pay = Object.values(ps?.pay || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  const deduct = Object.values(ps?.deduct || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return { pay, deduct, net: pay - deduct };
};

export async function savePayslip(ym, ps) {
  const all = await getPayslips();
  all[ym] = ps;
  await DB.setMeta('ledger.payslips', all);
  const { net } = payslipTotals(ps);
  const id = `payslip-${ym}`;
  const old = await DB.get('tx', id);
  await DB.put('tx', {
    ...(old || {}), id, type: 'income', date: ps.date, amount: net, kind: 'i-salary',
    place: `${Number(ym.slice(5))}월 급여 (월급명세서)`, memo: ps.memo || '', rec: { payslip: ym },
    createdAt: old?.createdAt || Date.now(), updatedAt: Date.now(),
  });
}
export async function deletePayslip(ym) {
  const all = await getPayslips();
  delete all[ym];
  await DB.setMeta('ledger.payslips', all);
  await DB.del('tx', `payslip-${ym}`);
}

export async function payItemLists() {
  const [pay, deduct] = await Promise.all([getList('payItems'), getList('deductItems')]);
  return { pay, deduct };
}
