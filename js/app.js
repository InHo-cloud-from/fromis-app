import { icon, esc } from './ui.js';
import * as Ledger from './ledger.js';
import * as Schedule from './schedule.js';
import * as Record from './record.js';

const TABS = [
  { id: 'ledger', label: '가계부', icon: 'wallet', mod: Ledger },
  { id: 'schedule', label: '일정', icon: 'calendar', mod: Schedule },
  { id: 'record', label: '기록', icon: 'book', mod: Record },
];

const view = document.getElementById('view');
const bar = document.querySelector('.tabbar');
let current = null;

bar.innerHTML = TABS.map((t) => `
  <button type="button" class="tab" data-tab="${t.id}">
    ${icon(t.icon)}<span>${esc(t.label)}</span>
  </button>`).join('');

bar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) show(b.dataset.tab);
});

function show(id) {
  if (id === current) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  if (current) { const prev = TABS.find((t) => t.id === current); prev?.mod?.unmount?.(); }
  current = tab.id;
  try { localStorage.setItem('tab', tab.id); } catch { /* 무시 */ }
  bar.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab.id ? 'page' : 'false'));
  view.innerHTML = '';
  window.scrollTo(0, 0);
  if (tab.mod) tab.mod.mount(view);
  else {
    view.innerHTML = `
      <header class="page-head"><div><p class="eyebrow">fromis_9</p><h1>${esc(tab.label)}</h1></div></header>
      <div class="empty"><div class="empty-ic">${icon(tab.icon)}</div><p>준비 중이에요</p><small>곧 만들 예정이에요.</small></div>`;
  }
}

let start = TABS[0].id;
try { start = localStorage.getItem('tab') || TABS[0].id; } catch { /* 무시 */ }
show(start);

// 다른 탭에서 이동 (예: 가계부 잠금화면의 D-day → 일정)
window.addEventListener('goto-tab', (e) => show(e.detail));

// PC 월페이퍼 폴더가 연결돼 있으면 일정이 바뀔 때마다 월페이퍼용 파일을 새로 씀
import('./wallpaper-link.js').then((m) => m.autoSync()).catch(() => {});

// PC 미리보기(Live Server 등)에서는 오프라인 캐시를 끔 → 수정한 내용이 바로 보이게
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator) {
  if (isLocal) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

// 기기 동기화 (구글 드라이브): 켜져 있으면 자동으로, 로그인이 만료되면 위쪽에 '눌러서 동기화' 버튼
import('./sync.js').then((S) => {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'sync-pill';
  pill.hidden = true;
  document.body.append(pill);
  const draw = () => {
    const st = S.status;
    if (!S.enabled()) { pill.hidden = true; return; }
    if (st.busy) { pill.hidden = false; pill.disabled = true; pill.textContent = `☁ 동기화 중${st.progress ? ' · ' + st.progress : ''}`; return; }
    pill.disabled = false;
    if (st.needLogin) { pill.hidden = false; pill.textContent = '☁ 눌러서 동기화'; return; }
    if (st.error) { pill.hidden = false; pill.textContent = '☁ 동기화 실패 · 다시'; return; }
    pill.hidden = true;
  };
  pill.addEventListener('click', async () => {
    try { await (S.status.needLogin ? S.loginAndSync() : S.syncNow()); } catch (e) { S.status.error = e.message; }
    draw();
  });
  window.addEventListener('sync-status', draw);
  S.start();
  draw();
}).catch(() => {});
