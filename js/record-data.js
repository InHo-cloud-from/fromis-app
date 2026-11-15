// 기록 데이터: 직관 기록, 앨범·노래 감상, 연말 결산
// meta 'record.shows'        = [{ id, title, kind, date, time, place, seat, rating, review, setlist: [곡], photos: [photoId], tx: [txId], eventId }]
// meta 'record.albums'       = { [albumId]: { rating, review, updatedAt, tracks: { [곡 번호]: { rating, note, fav, favAt } } } }
// meta 'record.customAlbums' = [{ id, title, type: 'etc', date, lead: [], tracks: [] }]
// meta 'record.dismissed'    = [eventId]  ('기록 남기기' 제안에서 닫은 일정)
import { DB } from './db.js';
import { today } from './ui.js';
import { DISCOGRAPHY } from './albums-data.js';
import { FANDOM } from './ledger-data.js';
import { getEvents } from './schedule-data.js';

export const KINDS = { concert: '콘서트', fanmeeting: '팬미팅', fansign: '팬싸', event: '행사', etc: '기타' };

export async function getShows() { return (await DB.getMeta('record.shows')) || []; }
export const saveShows = (v) => DB.setMeta('record.shows', v);
export async function getReviews() { return (await DB.getMeta('record.albums')) || {}; }
export const saveReviews = (v) => DB.setMeta('record.albums', v);
export async function getCustomAlbums() { return (await DB.getMeta('record.customAlbums')) || []; }
export const saveCustomAlbums = (v) => DB.setMeta('record.customAlbums', v);

export async function allAlbums() {
  return [...DISCOGRAPHY, ...(await getCustomAlbums())].sort((a, b) => b.date.localeCompare(a.date));
}

const addDays = (date, n) => {
  const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 지난 60일 안의 내 일정 중 아직 기록 안 한 것 → '기록 남기기' 제안
export async function suggestions() {
  const t = today(), from = addDays(t, -60);
  const [events, shows, dismissed] = await Promise.all([getEvents(), getShows(), DB.getMeta('record.dismissed').then((v) => v || [])]);
  const done = new Set(shows.map((s) => s.eventId).filter(Boolean));
  return events.filter((e) => !e.yearly && e.date >= from && e.date <= t && !done.has(e.id) && !dismissed.includes(e.id))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export async function dismiss(eventId) {
  const d = (await DB.getMeta('record.dismissed')) || [];
  await DB.setMeta('record.dismissed', [...d, eventId]);
}

// 직관에 연결할 만한 지출: 공연 45일 전 ~ 7일 뒤의 덕질 지출 + 이미 연결한 것
export async function linkableTx(date, linked = []) {
  const all = await DB.all('tx');
  const from = addDays(date || today(), -45), to = addDays(date || today(), 7);
  return all.filter((t) => linked.includes(t.id) || (t.type === 'expense' && t.cat === FANDOM && t.date >= from && t.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
}
export async function txByIds(ids = []) {
  if (!ids.length) return [];
  const all = await DB.all('tx');
  return all.filter((t) => ids.includes(t.id));
}

export async function recapYears() {
  const [shows, all] = await Promise.all([getShows(), DB.all('tx')]);
  const ys = new Set([today().slice(0, 4)]);
  shows.forEach((s) => ys.add(s.date.slice(0, 4)));
  all.forEach((t) => t.type === 'expense' && t.cat === FANDOM && ys.add(t.date.slice(0, 4)));
  return [...ys].sort().reverse();
}

// 연말 결산
export async function recap(year) {
  const [shows, all, reviews, albums] = await Promise.all([getShows(), DB.all('tx'), getReviews(), allAlbums()]);
  const ys = shows.filter((s) => s.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
  const fandom = all.filter((t) => t.type === 'expense' && t.cat === FANDOM && t.date.startsWith(year));
  const byMember = {}, bySub = {};
  for (const t of fandom) {
    byMember[t.member || ''] = (byMember[t.member || ''] || 0) + t.amount;
    bySub[t.sub || ''] = (bySub[t.sub || ''] || 0) + t.amount;
  }
  const txMap = new Map(all.map((t) => [t.id, t]));
  const showSpend = ys.reduce((n, s) => n + (s.tx || []).reduce((m, id) => m + (txMap.get(id)?.amount || 0), 0), 0);
  const byKind = {};
  ys.forEach((s) => { byKind[s.kind] = (byKind[s.kind] || 0) + 1; });
  const best = ys.filter((s) => s.rating).sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0] || null;

  const favs = [], rated = [];
  for (const a of albums) {
    const r = reviews[a.id];
    if (!r) continue;
    for (const [i, tr] of Object.entries(r.tracks || {})) {
      if (tr.fav && (tr.favAt || '').startsWith(year)) favs.push({ album: a.title, track: a.tracks[i], rating: tr.rating || 0 });
    }
    if (r.rating && (r.updatedAt || '').startsWith(year)) rated.push({ album: a, rating: r.rating });
  }
  favs.sort((a, b) => b.rating - a.rating);
  rated.sort((a, b) => b.rating - a.rating || b.album.date.localeCompare(a.album.date));
  const photos = ys.flatMap((s) => s.photos || []).slice(0, 6);
  return {
    year, shows: ys, byKind, best, showSpend, photos,
    fandomTotal: fandom.reduce((n, t) => n + t.amount, 0), fandomCount: fandom.length, byMember, bySub,
    favs, rated,
  };
}
