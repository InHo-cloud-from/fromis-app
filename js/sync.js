// 기기 동기화 (구글 드라이브 숨김 폴더)
// 드라이브: state.json = { v, at, clock, meta: {키: 값}, tx: [...], photos: [사진 정보(이미지 빼고)] }
//           photo-<id> = 사진 파일
// 합치는 규칙: 항목마다 마지막으로 바꾼 쪽이 이김 (db.js 의 '_sync.clock' 시각 비교)
//   - 두 기기에서 각각 추가한 항목은 둘 다 남음, 지운 항목은 양쪽에서 지워짐
//   - 동기화 전부터 있던 데이터(시각 기록 없음)는 합침
import { RAW, getClock, saveClock, isIdList, LOCAL_META } from './db.js';
import * as G from './gdrive.js';
import { notifyChange } from './data.js';

let D = G; // 시험할 때 가짜 드라이브로 바꿀 수 있게
export const _setDrive = (d) => { D = d; };
export const _merge = { mergeMeta, mergeRecords };
const STATE = 'state.json';
const photoName = (id) => `photo-${id}`;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 무시 */ } },
};

export const enabled = () => ls.get('sync.enabled') === '1' && G.configured();
export const status = { busy: false, needLogin: false, pending: false, error: '', progress: '', lastAt: ls.get('sync.lastAt') };
function setStatus(p) { Object.assign(status, p); window.dispatchEvent(new Event('sync-status')); }

/* ---------- 합치기 ---------- */
const abs = Math.abs;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 'L'(이 기기) 또는 'R'(드라이브)
function win(tL, tR, hasL, hasR) {
  if (abs(tL) !== abs(tR)) return abs(tL) > abs(tR) ? 'L' : 'R';
  if (hasL && !hasR) return 'L';
  return 'R';
}
const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const keysWith = (c, prefix) => Object.keys(c).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));

// 키로 구분되는 기록(tx, 사진 정보) 합치기
function mergeRecords(prefix, L, R, cL, cR) {
  const out = new Map();
  const localPut = [], localDel = [];
  let remoteChanged = false;
  const ids = new Set([...L.keys(), ...R.keys(), ...keysWith(cL, prefix), ...keysWith(cR, prefix)]);
  for (const id of ids) {
    const hasL = L.has(id), hasR = R.has(id);
    const w = win(cL[prefix + id] || 0, cR[prefix + id] || 0, hasL, hasR);
    const present = w === 'L' ? hasL : hasR;
    if (present) {
      const rec = w === 'L' ? L.get(id) : R.get(id);
      out.set(id, rec);
      if (!hasL || (w === 'R' && !same(L.get(id), rec))) localPut.push(rec);
      if (!hasR || (w === 'L' && !same(R.get(id), rec))) remoteChanged = true;
    } else {
      if (hasL) localDel.push(id);
      if (hasR) remoteChanged = true;
    }
  }
  return { out, localPut, localDel, remoteChanged };
}

// meta 값 하나 합치기
function mergeMeta(k, vL, vR, cL, cR) {
  const itemized = isIdList(vL) || isIdList(vR) || keysWith(cL, `meta:${k}#`).length || keysWith(cR, `meta:${k}#`).length;
  if (itemized && (vL === undefined || Array.isArray(vL)) && (vR === undefined || Array.isArray(vR))) {
    const aL = vL || [], aR = vR || [];
    const mL = new Map(aL.map((x) => [String(x.id), x])), mR = new Map(aR.map((x) => [String(x.id), x]));
    const p = `meta:${k}#`;
    const ids = new Set([...mL.keys(), ...mR.keys(), ...keysWith(cL, p), ...keysWith(cR, p)]);
    const keep = new Map();
    for (const id of ids) {
      const w = win(cL[p + id] || 0, cR[p + id] || 0, mL.has(id), mR.has(id));
      const item = w === 'L' ? mL.get(id) : mR.get(id);
      if (item) keep.set(id, item);
    }
    // 순서: 순서를 마지막으로 바꾼 쪽 기준, 나머지는 뒤에
    const base = win(cL[`meta:${k}`] || 0, cR[`meta:${k}`] || 0, !!vL, !!vR) === 'L' ? [aL, aR] : [aR, aL];
    const order = [...new Set([...base[0], ...base[1]].map((x) => String(x.id)))].filter((id) => keep.has(id));
    for (const id of keep.keys()) if (!order.includes(id)) order.push(id);
    const v = order.map((id) => keep.get(id));
    return { v, has: v.length > 0 || vL !== undefined || vR !== undefined };
  }
  const tL = cL[`meta:${k}`] || 0, tR = cR[`meta:${k}`] || 0;
  const hasL = vL !== undefined, hasR = vR !== undefined;
  // 둘 다 시각 기록이 없는 객체(예: 월급명세서, 앨범 감상)는 안쪽 키를 합침
  if (abs(tL) === abs(tR) && isPlainObj(vL) && isPlainObj(vR)) return { v: { ...vL, ...vR }, has: true };
  const w = win(tL, tR, hasL, hasR);
  return w === 'L' ? { v: vL, has: hasL } : { v: vR, has: hasR };
}

function mergeClock(a, b) {
  const c = { ...a };
  for (const [k, t] of Object.entries(b)) if (!(k in c) || abs(t) > abs(c[k])) c[k] = t;
  return c;
}

/* ---------- 동기화 한 번 ---------- */
let running = null;
export function syncNow() {
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  if (!D.hasToken()) { setStatus({ needLogin: true }); return false; }
  setStatus({ busy: true, error: '', progress: '' });
  let localChanged = false;
  try {
    const files = await D.listFiles();
    const remote = files[STATE] ? JSON.parse(await (await D.download(files[STATE].id)).text()) : { clock: {}, meta: {}, tx: [], photos: [] };
    const cR = remote.clock || {};
    const cL0 = { ...(await getClock()) };

    // meta
    const metaRows = (await RAW.all('meta')).filter((r) => !LOCAL_META(r.key));
    const mL = new Map(metaRows.map((r) => [r.key, r.value]));
    const mR = new Map(Object.entries(remote.meta || {}));
    const metaKeys = new Set([...mL.keys(), ...mR.keys(),
      ...[...Object.keys(cL0), ...Object.keys(cR)].filter((k) => k.startsWith('meta:')).map((k) => k.slice(5).split('#')[0])]);
    const metaOut = {};
    let remoteChanged = !files[STATE];
    for (const k of metaKeys) {
      if (LOCAL_META(k)) continue;
      const { v, has } = mergeMeta(k, mL.get(k), mR.get(k), cL0, cR);
      if (has) metaOut[k] = v;
      if (has && !same(mL.get(k), v)) { await RAW.put('meta', { key: k, value: v }); localChanged = true; }
      if (!has && mL.has(k)) { await RAW.del('meta', k); localChanged = true; }
      if (has ? !same(mR.get(k), v) : mR.has(k)) remoteChanged = true;
    }

    // 가계부 내역
    const txL = new Map((await RAW.all('tx')).map((t) => [t.id, t]));
    const txR = new Map((remote.tx || []).map((t) => [t.id, t]));
    const tx = mergeRecords('tx:', txL, txR, cL0, cR);
    for (const t of tx.localPut) await RAW.put('tx', t);
    for (const id of tx.localDel) await RAW.del('tx', id);
    if (tx.localPut.length || tx.localDel.length) localChanged = true;
    remoteChanged ||= tx.remoteChanged;

    // 사진: 정보는 state.json, 이미지는 파일 하나씩
    const photosAll = await RAW.all('photos');
    const pL = new Map(photosAll.map(({ blob, ...rest }) => [rest.id, rest]));
    const blobs = new Map(photosAll.map((p) => [p.id, p.blob]));
    const pR = new Map((remote.photos || []).map((p) => [p.id, p]));
    const ph = mergeRecords('photos:', pL, pR, cL0, cR);
    remoteChanged ||= ph.remoteChanged;
    let n = 0;
    const need = ph.localPut.filter((p) => !blobs.has(p.id));
    for (const p of ph.localPut) {
      if (blobs.has(p.id)) { await RAW.put('photos', { ...p, blob: blobs.get(p.id) }); localChanged = true; continue; }
      const f = files[photoName(p.id)];
      if (!f) continue; // 다른 기기가 아직 다 못 올림 → 다음에
      setStatus({ progress: `사진 받는 중 ${++n}/${need.length}` });
      await RAW.put('photos', { ...p, blob: await D.download(f.id) });
      localChanged = true;
    }
    for (const id of ph.localDel) { await RAW.del('photos', id); localChanged = true; }
    const toUpload = [...ph.out.keys()].filter((id) => blobs.has(id) && !files[photoName(id)]);
    n = 0;
    for (const id of toUpload) {
      setStatus({ progress: `사진 올리는 중 ${++n}/${toUpload.length}` });
      await D.upload(photoName(id), blobs.get(id));
    }
    for (const [name, f] of Object.entries(files)) {
      if (name.startsWith('photo-') && !ph.out.has(name.slice(6))) await D.remove(f.id);
    }

    // 시각 기록 합치기 (동기화하는 동안 이 기기에서 바뀐 건 그대로 둠 → 다음 동기화 때 올라감)
    let clock = mergeClock(cL0, cR);
    const cNow = await getClock();
    for (const [k, t] of Object.entries(cNow)) if (abs(t) > abs(cL0[k] || 0)) clock[k] = t;
    await saveClock(clock);
    if (!same(remote.clock || {}, mergeClock(cL0, cR))) remoteChanged = true;

    if (remoteChanged) {
      setStatus({ progress: '올리는 중' });
      const state = { v: 1, at: new Date().toISOString(), clock: mergeClock(cL0, cR), meta: metaOut, tx: [...tx.out.values()], photos: [...ph.out.values()] };
      await D.upload(STATE, new Blob([JSON.stringify(state)], { type: 'application/json' }), files[STATE]?.id);
    }
    const lastAt = new Date().toISOString();
    ls.set('sync.lastAt', lastAt);
    setStatus({ busy: false, needLogin: false, pending: false, progress: '', lastAt });
    return true;
  } catch (e) {
    setStatus({ busy: false, progress: '', needLogin: !!e.needLogin, error: e.needLogin ? '' : (e.message || '동기화 실패') });
    return false;
  } finally {
    if (localChanged) notifyChange();
  }
}

/* ---------- 켜기·끄기·자동 ---------- */
export async function connect() {
  await G.signIn();
  ls.set('sync.enabled', '1');
  start();
  return syncNow();
}
export async function loginAndSync() {
  await G.signIn();
  return syncNow();
}
export function disconnect() {
  ls.set('sync.enabled', null);
  G.forgetToken();
  setStatus({ needLogin: false, pending: false, error: '' });
}

let started = false, timer = 0;
function auto() {
  if (!enabled()) return;
  if (!G.hasToken()) { setStatus({ needLogin: true }); return; }
  syncNow();
}
export function start() {
  if (started || !enabled()) return;
  started = true;
  window.addEventListener('db-write', () => {
    if (!enabled()) return;
    setStatus({ pending: true });
    clearTimeout(timer);
    timer = setTimeout(auto, 4000); // 입력이 끝나고 4초 뒤에 한 번
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') auto(); });
  window.addEventListener('online', auto);
  auto();
}
