// 공통 UI 도구: 아이콘, 바텀시트, 토스트, 확인창
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/><path d="M9 8h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  minus: '<path d="M5 12h14"/>',
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- 바텀시트 (안드로이드 뒤로가기로 닫힘) ---------- */
const stack = [];

export function openSheet({ title, body = '', footer = '' }) {
  const wrap = el(`
    <div class="sheet-wrap">
      <div class="sheet-backdrop"></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="sheet-head">
          <span class="grab" aria-hidden="true"></span>
          <h2>${esc(title)}</h2>
          <button type="button" class="icon-btn sheet-x" aria-label="닫기">${icon('x')}</button>
        </header>
        <div class="sheet-body"></div>
        <footer class="sheet-foot"></footer>
      </section>
    </div>`);
  const bodyEl = wrap.querySelector('.sheet-body');
  const footEl = wrap.querySelector('.sheet-foot');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.append(body);
  if (typeof footer === 'string') footEl.innerHTML = footer; else footEl.append(footer);
  if (!footer) footEl.hidden = true;

  const entry = { wrap, onClose: null, closed: null };
  entry.closedPromise = new Promise((r) => { entry.closed = r; });
  stack.push(entry);
  document.body.append(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  history.pushState({ sheet: stack.length }, '');

  const close = () => {
    if (stack.includes(entry)) history.back();
    return entry.closedPromise;
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelector('.sheet-x').addEventListener('click', close);

  return {
    wrap, body: bodyEl, foot: footEl, close,
    set onClose(f) { entry.onClose = f; },
  };
}

window.addEventListener('popstate', () => {
  const e = stack.pop();
  if (!e) return;
  e.wrap.classList.remove('open');
  setTimeout(() => e.wrap.remove(), 280);
  if (!stack.length) document.body.classList.remove('no-scroll');
  if (e.onClose) e.onClose();
  e.closed();
});

/* ---------- 확인창 ---------- */
export function confirmSheet(message, { ok = '확인', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet({
      title: '확인',
      body: `<p class="confirm-msg">${esc(message)}</p>`,
      footer: `<button type="button" class="btn" data-r="0">취소</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button>`,
    });
    s.onClose = () => { if (!done) resolve(false); };
    s.foot.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      done = true;
      await s.close();
      resolve(b.dataset.r === '1');
    });
  });
}

/* ---------- 토스트 ---------- */
let toastTimer;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('<div class="toast" role="status" aria-live="polite"></div>'); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- 파일 저장 ---------- */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el(`<a href="${url}" download="${esc(filename)}"></a>`);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareFile(blob, filename, text = '') {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return true; } catch { return false; }
  }
  return false;
}

export const canShareFiles = () => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })); } catch { return false; }
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
