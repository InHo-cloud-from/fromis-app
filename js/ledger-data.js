// 가계부 데이터: 분류·결제수단·예산 기본값과 계산 도우미
import { DB } from './db.js';

export const FANDOM = 'fandom'; // 대분류 '덕질' 고정 id

// 대분류 기본값: 사용자가 쓰던 가계부 시트 기준 + 덕질. (카드값은 '카드값 납부'로 따로 기록)
const DEFAULT_CATS = [
  [FANDOM, '덕질'], ['c-house', '주거/관리비'], ['c-food', '식비'], ['c-car', '차량유지비'], ['c-transit', '교통비'],
  ['c-phone', '통신비'], ['c-health', '의료/건강'], ['c-hobby', '취미생활'], ['c-shop', '쇼핑'], ['c-event', '경조사'],
  ['c-fixed', '고정지출'], ['c-saving', '적금/저축'], ['c-insure', '보험'], ['c-loan', '대출'], ['c-etc', '기타'],
].map(([id, name]) => ({ id, name }));

const DEFAULT_SUBS = [
  ['s-album', '앨범'], ['s-goods', '굿즈·MD'], ['s-show', '공연·티켓'], ['s-apply', '팬싸·영통 응모'], ['s-club', '팬클럽·멤버십'],
  ['s-trip', '교통·숙박'], ['s-food', '식비·카페'], ['s-fee', '배송비·수수료'], ['s-etc', '기타'],
].map(([id, name]) => ({ id, name }));

const DEFAULT_PAYS = [
  { id: 'p-cash', name: '현금', card: false },
  { id: 'p-bank', name: '계좌이체', card: false },
  { id: 'p-card', name: '카드', card: true },
  { id: 'p-easy', name: '간편결제', card: false },
];

const DEFAULT_INCOME_KINDS = [
  ['i-salary', '급여'], ['i-bonus', '상여'], ['i-side', '부수입'], ['i-allow', '용돈'], ['i-refund', '환급'], ['i-etc', '기타'],
].map(([id, name]) => ({ id, name }));

const LISTS = { cats: DEFAULT_CATS, subs: DEFAULT_SUBS, pays: DEFAULT_PAYS, incomeKinds: DEFAULT_INCOME_KINDS };

// 목록은 meta 'ledger.<이름>' 에 저장. 삭제는 hidden 표시만 (예전 내역의 이름이 남도록)
export async function getList(name) {
  let v = await DB.getMeta(`ledger.${name}`);
  if (!v) { v = LISTS[name].map((x) => ({ ...x })); await DB.setMeta(`ledger.${name}`, v); }
  return v;
}
export const saveList = (name, v) => DB.setMeta(`ledger.${name}`, v);
export const visible = (list) => list.filter((x) => !x.hidden);
export const nameOf = (list, id, fallback = '') => list.find((x) => x.id === id)?.name ?? fallback;

/* ---------- 예산 ----------
   { base: { total, cats: { [catId]: n, ['sub:'+subId]: n } }, months: { 'YYYY-MM': 같은 모양 } }
   그 달 값이 있으면 그 달 것, 없으면 base(매달 기본) */
export async function getBudgetStore() {
  return (await DB.getMeta('ledger.budget')) || { base: { total: null, cats: {} }, months: {} };
}
export const saveBudgetStore = (b) => DB.setMeta('ledger.budget', b);
export function budgetFor(store, ym) {
  const m = store.months?.[ym];
  return { ...(m || store.base || { total: null, cats: {} }), custom: !!m };
}

/* ---------- 날짜·돈 ---------- */
export const ymOf = (date) => date.slice(0, 7);
export function shiftYM(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const ymLabel = (ym) => { const [y, m] = ym.split('-'); return `${y}년 ${Number(m)}월`; };
export const won = (n) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;
export const parseWon = (s) => { const n = Number(String(s).replace(/[^\d]/g, '')); return Number.isFinite(n) ? n : 0; };

export async function txOfMonth(ym) {
  return (await DB.all('tx')).filter((t) => t.date && t.date.startsWith(ym));
}

// 한 달 합계 계산 (카드값 납부는 지출에 넣지 않음)
export function summarize(txs, pays) {
  const isCard = (id) => !!pays.find((p) => p.id === id)?.card;
  const s = { income: 0, expense: 0, cardUse: 0, cashExpense: 0, cardPay: 0, byCat: {}, bySub: {}, byMember: {}, fandom: 0 };
  for (const t of txs) {
    if (t.type === 'income') s.income += t.amount;
    else if (t.type === 'cardpay') s.cardPay += t.amount;
    else if (t.type === 'expense') {
      s.expense += t.amount;
      if (isCard(t.pay)) s.cardUse += t.amount; else s.cashExpense += t.amount;
      s.byCat[t.cat] = (s.byCat[t.cat] || 0) + t.amount;
      if (t.cat === FANDOM) {
        s.fandom += t.amount;
        if (t.sub) s.bySub[t.sub] = (s.bySub[t.sub] || 0) + t.amount;
        const m = t.member || '';
        s.byMember[m] = (s.byMember[m] || 0) + t.amount;
      }
    }
  }
  return s;
}
