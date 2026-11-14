// 꾸미기 사진: 배너(여러 장, 랜덤) / 멤버 프로필(멤버당 1장)
// 사진은 이 기기의 IndexedDB 'photos' 에만 저장 (저작권 이미지라 저장소에 넣지 않음)
// { id, kind: 'banner' | 'member', member?: '하영', blob, createdAt }
import { DB } from './db.js';
import { uid } from './ui.js';
import { ANNIVERSARIES, MEMBERS } from './data.js';

const urls = new Map();
export function photoURL(p) {
  if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob));
  return urls.get(p.id);
}
function dropURL(id) {
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
}

export const allPhotos = () => DB.all('photos');
export async function banners() { return (await allPhotos()).filter((p) => p.kind === 'banner').sort((a, b) => a.createdAt - b.createdAt); }
export async function memberPhotos() {
  const out = {};
  for (const p of await allPhotos()) if (p.kind === 'member' && p.member) out[p.member] = p;
  return out;
}

// 사진 줄이기: 배너는 긴 변 1600px, 프로필은 정사각형 400px (얼굴이 위쪽에 많아 위쪽 기준으로 자름)
async function shrink(file, { max, square }) {
  const bmp = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) * 0.25;
    sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('변환 실패'))), 'image/jpeg', 0.86));
}

export async function addBanner(file, extra = {}) {
  const blob = await shrink(file, { max: 1400 });
  const bmp = await createImageBitmap(blob); // 가로/세로 판단용 크기
  const size = { w: bmp.width, h: bmp.height };
  bmp.close?.();
  await DB.put('photos', { id: uid(), kind: 'banner', member: null, blob, createdAt: Date.now(), ...size, ...extra });
}

// 월페이퍼 폴더 통째로 불러오기: 하위 폴더 이름이 멤버 이름이면 멤버로, 아니면 유닛 이름(group)으로 저장
// 같은 파일(경로+크기)은 다시 넣지 않음. 프로필 없는 멤버는 그 멤버 폴더에서 한 장 골라 프로필로.
export async function importFolder(files, onProgress = () => {}) {
  const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif)$/i.test(f.name));
  const have = new Set((await allPhotos()).map((p) => p.src).filter(Boolean));
  const byMember = {};
  let added = 0, skipped = 0, failed = 0;
  for (let i = 0; i < imgs.length; i++) {
    const f = imgs[i];
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    const folder = parts.length > 2 ? parts[parts.length - 2] : '';
    const src = `${rel}|${f.size}`;
    if (MEMBERS.includes(folder)) (byMember[folder] ||= []).push(f);
    if (have.has(src)) { skipped++; }
    else {
      try {
        await addBanner(f, { src, member: MEMBERS.includes(folder) ? folder : null, group: MEMBERS.includes(folder) ? null : folder || null });
        added++;
      } catch { failed++; }
    }
    onProgress(i + 1, imgs.length);
  }
  const mp = await memberPhotos();
  let profiles = 0;
  for (const m of MEMBERS) {
    const list = byMember[m];
    if (mp[m] || !list?.length) continue;
    try { await setMemberPhoto(m, list[Math.floor(Math.random() * list.length)]); profiles++; } catch { /* 건너뜀 */ }
  }
  resetBannerPick();
  return { added, skipped, failed, profiles, total: imgs.length };
}

// 사진을 누르면 다음 사진으로 (랜덤, 방금 것 제외)
export async function nextBanner() {
  const list = await banners();
  if (list.length < 2) return;
  const rest = list.filter((p) => p.id !== picked?.id);
  picked = rest[Math.floor(Math.random() * rest.length)];
}

// 첫 화면 모양: 'lock' 잠금화면 / 'banner' 배너 / 'polaroid' 폴라로이드
export const LAYOUTS = [['lock', '잠금화면'], ['banner', '배너'], ['polaroid', '폴라로이드']];
export async function getLayout() { return (await DB.getMeta('decor.layout')) || 'lock'; }
export const setLayout = (v) => DB.setMeta('decor.layout', v);

// 사진 맞추기: 'contain' 전체 보이기(남는 곳은 흐린 사진) / 'cover' 꽉 채우기(잘림)
export const FITS = [['contain', '전체 보이기'], ['cover', '꽉 채우기']];
export async function getFit() { return (await DB.getMeta('decor.fit')) || 'contain'; }
export const setFit = (v) => DB.setMeta('decor.fit', v);
export async function setMemberPhoto(member, file) {
  const blob = await shrink(file, { max: 400, square: true });
  const old = (await memberPhotos())[member];
  if (old) { await DB.del('photos', old.id); dropURL(old.id); }
  await DB.put('photos', { id: uid(), kind: 'member', member, blob, createdAt: Date.now() });
}
export async function updatePhoto(p, patch) { await DB.put('photos', { ...p, ...patch }); }
export async function removePhoto(id) { await DB.del('photos', id); dropURL(id); }

// 오늘 생일인 멤버 (없으면 null)
export function birthdayToday(d = new Date()) {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return ANNIVERSARIES.find((a) => a.kind === 'birthday' && a.md === md)?.member || null;
}

// 앱을 열 때 한 번 고른 배너를 유지 (다시 그려도 깜빡이며 바뀌지 않게)
let picked = null;
export async function pickBanner() {
  const list = await banners();
  if (!list.length) { picked = null; return null; }
  if (picked && list.some((p) => p.id === picked.id)) return list.find((p) => p.id === picked.id);
  const bd = birthdayToday();
  const pool = (bd && list.filter((p) => p.member === bd).length) ? list.filter((p) => p.member === bd) : list;
  picked = pool[Math.floor(Math.random() * pool.length)];
  return picked;
}
export function resetBannerPick() { picked = null; }
export const isWide = (p) => !!(p?.w && p?.h && p.w > p.h * 1.1);
