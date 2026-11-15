// PC 월페이퍼(fromis9-wallpaper · Wallpaper Engine) 연동
// PC 크롬에서 월페이퍼 폴더를 한 번 골라 두면, 일정이 바뀔 때마다 그 폴더에 app-schedule.js 를 새로 써요.
// 월페이퍼는 몇 분마다 이 파일을 다시 읽어서 달력·D-day 아래에 보여줘요.
// 폴더 정보(handle)는 이 컴퓨터 브라우저에만 저장되고 백업 파일에는 안 들어가요.
import { DB } from './db.js';
import { today } from './ui.js';
import * as S from './schedule-data.js';

export const FILE = 'app-schedule.js';
const KEY_DIR = 'wallpaper.dir';
const KEY_KINDS = 'wallpaper.kinds';
const KEY_AT = 'wallpaper.syncedAt';
export const LOCAL_KEYS = [KEY_DIR, KEY_AT]; // 백업에서 빼는 값 (이 컴퓨터 전용)

export const KINDS = [['mine', '내 일정'], ['apply', '응모 마감'], ['pay', '고정지출·할부 납부일']];
const DEFAULT_KINDS = ['apply'];

export const supported = () => typeof window.showDirectoryPicker === 'function';
export async function getKinds() { return (await DB.getMeta(KEY_KINDS)) || DEFAULT_KINDS; }
export const setKinds = (v) => DB.setMeta(KEY_KINDS, v);
const getDir = () => DB.getMeta(KEY_DIR);

async function perm(dir) {
  try { return await dir.queryPermission({ mode: 'readwrite' }); } catch { return 'denied'; }
}

// none = 연결 안 함, ok = 자동 저장 중, need = 브라우저를 다시 켜서 허락이 한 번 더 필요
export async function status() {
  const dir = await getDir();
  if (!dir) return { state: 'none' };
  return { state: (await perm(dir)) === 'granted' ? 'ok' : 'need', name: dir.name, at: await DB.getMeta(KEY_AT) };
}

export async function connect() {
  const dir = await window.showDirectoryPicker({ id: 'fromis-wallpaper', mode: 'readwrite' });
  let ok = false;
  for (const n of ['project.json', 'index.html']) {
    try { await dir.getFileHandle(n); ok = true; break; } catch { /* 없음 */ }
  }
  if (!ok) throw new Error('월페이퍼 폴더가 아닌 것 같아요 (index.html 이 없어요)');
  await DB.setMeta(KEY_DIR, dir);
  last = '';
  await sync();
  return dir.name;
}

export async function reconnect() {
  const dir = await getDir();
  if (!dir) return false;
  if ((await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
  last = '';
  await sync();
  return true;
}

export async function disconnect() { await DB.del('meta', KEY_DIR); last = ''; }

const pad = (n) => String(n).padStart(2, '0');
const monthStart = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };

// 월페이퍼 형식으로 바꾸기: SCHEDULE = [{date:'YYYY-MM-DD', text, time}], ANNIVERSARIES = [{date:'MM-DD', text, year}]
export async function build() {
  const kinds = await getKinds();
  const yearly = kinds.includes('mine') ? (await S.getEvents()).filter((e) => e.yearly) : [];
  const yearlyIds = new Set(yearly.map((e) => e.id));
  const items = (await S.itemsBetween(monthStart(-2), monthStart(14)))
    .filter((x) => kinds.includes(x.src) && !(x.src === 'mine' && yearlyIds.has(x.ref)));
  const sched = items.map((x) => ({ date: x.date, text: x.title, ...(x.time ? { time: x.time } : {}) }));
  const anniv = yearly.map((e) => ({ date: e.date.slice(5), text: e.title, year: Number(e.date.slice(0, 4)) }));
  return `window.APP_SCHEDULE = ${JSON.stringify(sched, null, 1)};\nwindow.APP_ANNIVERSARIES = ${JSON.stringify(anniv, null, 1)};\n`;
}

let last = '';
let busy = null;
export async function sync() {
  if (busy) return busy;
  busy = (async () => {
    const dir = await getDir();
    if (!dir || (await perm(dir)) !== 'granted') return false;
    const body = await build();
    if (body === last) return true;
    const text = `// 덕질노트 앱이 자동으로 만든 파일이에요. 앱에서 일정을 저장할 때마다 덮어써요. (직접 고치지 마세요)\n// ${today()} 기준\n${body}`;
    const fh = await dir.getFileHandle(FILE, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    last = body;
    await DB.setMeta(KEY_AT, new Date().toISOString());
    return true;
  })().catch(() => false).finally(() => { busy = null; });
  return busy;
}

// 앱 시작 시 한 번 + 데이터가 바뀔 때마다 (0.8초 모아서)
let timer = 0;
export function autoSync() {
  if (!supported()) return;
  sync();
  window.addEventListener('data-changed', () => { clearTimeout(timer); timer = setTimeout(sync, 800); });
}
