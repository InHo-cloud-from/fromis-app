// IndexedDB 래퍼: 모든 데이터(사진 포함)는 폰 브라우저 안에만 저장됩니다.
const NAME = 'fromis-app';
const VER = 1;
export const STORES = ['photos', 'meta'];
const KEYS = { photos: 'id', meta: 'key' };

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

export const DB = {
  all: (s) => run(s, 'readonly', (o) => o.getAll()),
  get: (s, k) => run(s, 'readonly', (o) => o.get(k)),
  put: (s, v) => run(s, 'readwrite', (o) => o.put(v)),
  del: (s, k) => run(s, 'readwrite', (o) => o.delete(k)),
  replaceAll: (s, rows) => run(s, 'readwrite', (o) => { o.clear(); rows.forEach((r) => o.put(r)); }),
  async getMeta(k) { const r = await DB.get('meta', k); return r ? r.value : undefined; },
  setMeta: (k, v) => DB.put('meta', { key: k, value: v }),
};

// 브라우저가 저장공간이 부족할 때 데이터를 지우지 않도록 요청
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* 지원 안 하면 무시 */ }
}
