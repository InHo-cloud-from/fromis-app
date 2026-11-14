export const MEMBERS = ['하영', '지원', '채영', '나경', '지헌'];

// 기념일 (매년 반복). 출처: 한국어 위키백과 '프로미스나인' (2026-11-15 확인)
// year: 처음 시작한 해 → 몇 번째인지 계산할 때 사용
export const ANNIVERSARIES = [
  { id: 'debut', title: '데뷔', md: '01-24', year: 2018, kind: 'debut' },
  { id: 'bd-jiwon', title: '지원 생일', md: '03-20', year: 1998, kind: 'birthday', member: '지원' },
  { id: 'bd-jiheon', title: '지헌 생일', md: '04-17', year: 2003, kind: 'birthday', member: '지헌' },
  { id: 'bd-chaeyoung', title: '채영 생일', md: '05-14', year: 2000, kind: 'birthday', member: '채영' },
  { id: 'bd-nagyung', title: '나경 생일', md: '06-01', year: 2000, kind: 'birthday', member: '나경' },
  { id: 'bd-hayoung', title: '하영 생일', md: '09-29', year: 1997, kind: 'birthday', member: '하영' },
];

export const memberIndex = (m) => { const i = MEMBERS.indexOf(m); return i < 0 ? 99 : i; };

export function notifyChange() { window.dispatchEvent(new Event('data-changed')); }
