// IndexedDB 래퍼: 모든 데이터(사진 포함)는 이 기기 브라우저 안에 저장됩니다.
// 기기 동기화를 위해 바뀐 시각을 meta '_sync.clock' 에 적어 둡니다.
//   { 'tx:<id>': ms, 'photos:<id>': ms, 'meta:<key>': ms, 'meta:<key>#<항목id>': ms }  (음수 = 지운 것)
//   meta 값이 [{id,...}] 목록이면 항목마다 따로 적어서, 두 기기에서 각각 추가한 항목이 합쳐지게 합니다.
const NAME = 'fromis-app';
const VER = 2;
export const STORES = ['photos', 'meta', 'tx'];
const KEYS = { photos: 'id', meta: 'key', tx: 'id' };

// 동기화하지 않는 이 기기 전용 값
export const LOCAL_META = (k) => k.startsWith('_sync') || ['wallpaper.dir', 'wallpaper.syncedAt', 'lastBackup'].includes(k);
const CLOCK = '_sync.clock';

let dbp;
function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEYS[s] });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

// 기록 없이 바로 쓰기 (동기화가 받아온 값을 넣을 때)
export const RAW = {
  all: (s) => run(s, 'readonly', (o) => o.getAll()),
  get: (s, k) => run(s, 'readonly', (o) => o.get(k)),
  put: (s, v) => run(s, 'readwrite', (o) => o.put(v)),
  del: (s, k) => run(s, 'readwrite', (o) => o.delete(k)),
  replaceAll: (s, rows) => run(s, 'readwrite', (o) => { o.clear(); rows.forEach((r) => o.put(r)); }),
};

/* ---------- 바뀐 시각 기록 ---------- */
let clockP = null;
export function getClock() {
  if (!clockP) clockP = RAW.get('meta', CLOCK).then((r) => (r && r.value) || {});
  return clockP;
}
export function _reloadClock() { clockP = null; } // 시험용
export async function saveClock(c) { clockP = Promise.resolve(c); await RAW.put('meta', { key: CLOCK, value: c }); }

let stampTs = 0;
const now = () => { stampTs = Math.max(Date.now(), stampTs + 1); return stampTs; };
export const isIdList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object' && 'id' in x);

async function stamp(changes) {
  if (!changes.length) return;
  const c = await getClock();
  for (const [k, del] of changes) c[k] = del ? -now() : now();
  await saveClock(c);
  window.dispatchEvent(new Event('db-write'));
}

// meta 값이 바뀔 때 기록할 항목 (목록이면 항목별, 아니면 통째로)
function metaChanges(key, oldV, newV) {
  if (LOCAL_META(key)) return [];
  const out = [];
  if (isIdList(oldV) || isIdList(newV) || (Array.isArray(newV) && Array.isArray(oldV))) {
    const o = new Map((Array.isArray(oldV) ? oldV : []).map((x) => [String(x.id), JSON.stringify(x)]));
    const n = new Map((Array.isArray(newV) ? newV : []).map((x) => [String(x.id), JSON.stringify(x)]));
    for (const [id, s] of n) if (o.get(id) !== s) out.push([`meta:${key}#${id}`, false]);
    for (const id of o.keys()) if (!n.has(id)) out.push([`meta:${key}#${id}`, true]);
    const order = (m) => [...m.keys()].join('|');
    if (order(o) !== order(n)) out.push([`meta:${key}`, false]); // 순서만 바뀐 경우
    return out;
  }
  if (newV === undefined) return [[`meta:${key}`, true]];
  if (JSON.stringify(oldV) !== JSON.stringify(newV)) out.push([`meta:${key}`, false]);
  return out;
}

export const DB = {
  all: RAW.all,
  get: RAW.get,
  async put(s, v) {
    if (s === 'meta') return DB.setMeta(v.key, v.value);
    await RAW.put(s, v);
    await stamp([[`${s}:${v[KEYS[s]]}`, false]]);
  },
  async del(s, k) {
    if (s === 'meta') {
      const old = await DB.getMeta(k);
      await RAW.del('meta', k);
      await stamp(metaChanges(k, old, undefined));
      return;
    }
    await RAW.del(s, k);
    await stamp([[`${s}:${k}`, true]]);
  },
  async replaceAll(s, rows) {
    const old = await RAW.all(s);
    await RAW.replaceAll(s, rows);
    const ch = [];
    const key = KEYS[s];
    if (s === 'meta') {
      const o = new Map(old.map((r) => [r.key, r.value]));
      const n = new Map(rows.map((r) => [r.key, r.value]));
      for (const k of new Set([...o.keys(), ...n.keys()])) ch.push(...metaChanges(k, o.get(k), n.has(k) ? n.get(k) : undefined));
    } else {
      const o = new Map(old.map((r) => [r[key], r]));
      for (const r of rows) {
        const prev = o.get(r[key]);
        if (!prev || (s === 'tx' ? JSON.stringify(prev) !== JSON.stringify(r) : prev.blob?.size !== r.blob?.size)) ch.push([`${s}:${r[key]}`, false]);
        o.delete(r[key]);
      }
      for (const k of o.keys()) ch.push([`${s}:${k}`, true]);
    }
    await stamp(ch);
  },
  async getMeta(k) { const r = await RAW.get('meta', k); return r ? r.value : undefined; },
  async setMeta(k, v) {
    const old = LOCAL_META(k) ? undefined : await DB.getMeta(k);
    await RAW.put('meta', { key: k, value: v });
    await stamp(metaChanges(k, old, v));
  },
};

// 브라우저가 저장공간이 부족할 때 데이터를 지우지 않도록 요청
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* 지원 안 하면 무시 */ }
}
