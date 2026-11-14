import { icon, esc } from './ui.js';
import * as Ledger from './ledger.js';

const TABS = [
  { id: 'ledger', label: '가계부', icon: 'wallet', mod: Ledger },
  { id: 'schedule', label: '일정', icon: 'calendar' },
  { id: 'record', label: '기록', icon: 'book' },
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
