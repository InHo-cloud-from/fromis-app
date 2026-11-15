// 일정 데이터: 내 일정 + 자동(기념일, 응모 마감, 고정지출·할부 납부일)
// 내 일정: meta 'schedule.events' = [{ id, title, date, time, yearly, memo }]
import { DB } from './db.js';
import { today } from './ui.js';
import { ANNIVERSARIES } from './data.js';

export async function getEvents() { return (await DB.getMeta('schedule.events')) || []; }
export const saveEvents = (v) => DB.setMeta('schedule.events', v);

const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(y, m, 0).getDate();
export const dayDiff = (from, to) => Math.round((new Date(to + 'T00:00') - new Date(from + 'T00:00')) / 86400000);
export const dText = (n) => (n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`);

// from~to (YYYY-MM-DD, 포함) 사이의 모든 일정
// item: { key, date, time, title, sub, src: 'mine'|'anniv'|'apply'|'pay', ref }
export async function itemsBetween(from, to) {
  const [events, applies, rules] = await Promise.all([
    getEvents(), DB.getMeta('fandom.applies').then((v) => v || []), DB.getMeta('ledger.rules').then((v) => v || []),
  ]);
  const out = [];
  const fy = Number(from.slice(0, 4)), ty = Number(to.slice(0, 4));
  const inRange = (d) => d >= from && d <= to;

  for (const e of events) {
    if (e.yearly) {
      for (let y = fy; y <= ty; y++) {
        const d = `${y}${e.date.slice(4)}`;
        if (d >= e.date && inRange(d)) out.push({ key: `e-${e.id}-${y}`, date: d, time: e.time || '', title: e.title, sub: e.memo || '', src: 'mine', ref: e.id });
      }
    } else if (inRange(e.date)) out.push({ key: `e-${e.id}`, date: e.date, time: e.time || '', title: e.title, sub: e.memo || '', src: 'mine', ref: e.id });
  }

  for (const a of ANNIVERSARIES) {
    for (let y = fy; y <= ty; y++) {
      const d = `${y}-${a.md}`;
      if (!inRange(d)) continue;
      const n = y - a.year;
      const sub = a.kind === 'debut' ? `${n}주년` : `${n}번째 생일`; // 1997년생 → 2026년 = 29번째
      out.push({ key: `an-${a.id}-${y}`, date: d, time: '', title: a.kind === 'debut' ? '프로미스나인 데뷔 기념일' : a.title, sub, src: 'anniv', ref: a.id });
    }
  }

  for (const a of applies) {
    if (a.result !== 'wait' || !a.deadline || !inRange(a.deadline)) continue;
    out.push({ key: `ap-${a.id}`, date: a.deadline, time: '', title: `${a.title} 응모 마감`, sub: [a.shop, a.count ? `${a.count}장` : ''].filter(Boolean).join(' · '), src: 'apply', ref: a.id });
  }

  // 고정지출·할부 납부일 (적금은 제외)
  for (const r of rules) {
    if (r.paused || (r.kind !== 'fixed' && r.kind !== 'install')) continue;
    let [y, m] = from.slice(0, 7).split('-').map(Number);
    for (let guard = 0; guard < 26; guard++) {
      const ym = `${y}-${pad(m)}`;
      if (ym > to.slice(0, 7)) break;
      const d = `${ym}-${pad(Math.min(r.day || 1, lastDay(y, m)))}`;
      const n = (y - Number(r.startYM.slice(0, 4))) * 12 + (m - Number(r.startYM.slice(5))) + 1;
      const ok = ym >= r.startYM && !(r.endYM && ym > r.endYM) && !(r.kind === 'install' && n > r.months);
      if (ok && inRange(d)) {
        out.push({ key: `p-${r.id}-${ym}`, date: d, time: '', title: `${r.name} 납부`, sub: r.kind === 'install' ? `할부 ${n}/${r.months}` : '고정지출', src: 'pay', ref: r.id, amount: r.amount });
      }
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  const order = { anniv: 0, mine: 1, apply: 2, pay: 3 };
  return out.sort((a, b) => a.date.localeCompare(b.date) || order[a.src] - order[b.src] || (a.time || '').localeCompare(b.time || ''));
}

const addDays = (date, n) => {
  const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const upcoming = (days = 60) => { const t = today(); return itemsBetween(t, addDays(t, days)); };

// 가장 가까운 D-day (매달 돌아오는 납부일은 빼고)
export async function nextDday() {
  const t = today();
  const list = (await itemsBetween(t, addDays(t, 400))).filter((x) => x.src !== 'pay');
  return list[0] ? { ...list[0], d: dayDiff(t, list[0].date) } : null;
}
