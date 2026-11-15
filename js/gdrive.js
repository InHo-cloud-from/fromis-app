// 구글 드라이브 연결 (구글 로그인 + 드라이브 '앱 전용 숨김 폴더')
// - 범위: drive.appdata → 이 앱이 만든 숨김 폴더만 읽고 씀. 사용자의 다른 드라이브 파일은 못 봄.
// - 로그인 토큰은 1시간짜리라, 만료되면 한 번 눌러서 다시 받아야 함 (브라우저 앱이라 자동 갱신 불가)
import { GOOGLE_CLIENT_ID } from './sync-config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'sync.token';

export const configured = () => !!GOOGLE_CLIENT_ID;

let token = null;
try { token = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { /* 무시 */ }
export const hasToken = () => !!(token && token.exp > Date.now() + 60_000);
export function forgetToken() {
  if (token?.access_token) try { window.google?.accounts?.oauth2?.revoke(token.access_token, () => {}); } catch { /* 무시 */ }
  token = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* 무시 */ }
}

let gisP = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisP) {
    gisP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => { gisP = null; rej(new Error('구글 로그인을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); };
      document.head.append(s);
    });
  }
  return gisP;
}

// 로그인 창 열기 (버튼을 누른 직후에 불러야 팝업이 막히지 않음)
export async function signIn() {
  if (!configured()) throw new Error('구글 연결 설정(Client ID)이 아직 없어요.');
  await loadGis();
  return new Promise((res, rej) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) { rej(new Error(r.error_description || r.error)); return; }
        token = { access_token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch { /* 무시 */ }
        res(true);
      },
      error_callback: (e) => rej(new Error(e?.type === 'popup_closed' ? '로그인 창을 닫았어요' : e?.type === 'popup_failed_to_open' ? '로그인 창이 막혔어요. 팝업을 허용해 주세요.' : '로그인하지 못했어요')),
    });
    let hint = '';
    try { hint = localStorage.getItem('sync.consented') ? '' : 'consent'; } catch { /* 무시 */ }
    client.requestAccessToken({ prompt: hint });
    try { localStorage.setItem('sync.consented', '1'); } catch { /* 무시 */ }
  });
}

async function call(url, opts = {}) {
  if (!hasToken()) throw Object.assign(new Error('다시 로그인이 필요해요'), { needLogin: true });
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token.access_token}`, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* 무시 */ } throw Object.assign(new Error('다시 로그인이 필요해요'), { needLogin: true }); }
  if (!r.ok) throw new Error(`드라이브 오류 (${r.status})`);
  return r;
}

// 숨김 폴더의 파일 목록: { 이름: { id, modifiedTime } }
export async function listFiles() {
  const out = {};
  let pageToken = '';
  do {
    const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '1000', ...(pageToken ? { pageToken } : {}) });
    const j = await (await call(`${API}/files?${q}`)).json();
    for (const f of j.files || []) out[f.name] = f;
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

export const download = async (id) => (await call(`${API}/files/${id}?alt=media`)).blob();

// 새로 만들기 (id 없음) 또는 내용 바꾸기
export async function upload(name, blob, id) {
  if (id) {
    await call(`${UP}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
    return id;
  }
  const meta = { name, parents: ['appDataFolder'] };
  const b = 'fromisapp' + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`,
  ]);
  const j = await (await call(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body })).json();
  return j.id;
}

export async function remove(id) {
  try { await call(`${API}/files/${id}`, { method: 'DELETE' }); } catch (e) { if (e.needLogin) throw e; /* 이미 없으면 무시 */ }
}
