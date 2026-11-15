// 기록 탭: 직관 기록 / 앨범·노래 감상 / 연말 결산
import { icon, esc, uid, openSheet, toast, confirmSheet, today } from './ui.js';
import { MEMBERS, notifyChange } from './data.js';
import * as R from './record-data.js';
import { TYPE_NAMES, coverURL } from './albums-data.js';
import * as P from './photos.js';
import * as L from './ledger-data.js';
import { avatarHTML } from './decor-settings.js';
import { openSettings } from './settings.js';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const VIEWS = [['shows', '직관'], ['albums', '앨범'], ['recap', '연말 결산']];
const state = { view: 'shows', year: today().slice(0, 4), albumFilter: 'all' };
const ALBUM_FILTERS = [['all', '전체'], ['album', '앨범'], ['ost', 'OST'], ['solo', '개인곡']];
const isSong = (a) => a.type === 'ost' || a.type === 'solo'; // 한 곡짜리(OST·개인곡)
// 커버: 애플 뮤직 이미지. 못 불러오면 색 타일 + 제목으로
const coverHTML = (a, i, size = 600) => {
  const src = coverURL(a, size);
  return `<span class="album-cover ph-${i % 5}${src ? ' has-art' : ''}">${src ? `<img src="${src}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has-art');this.remove()">` : ''}<b>${esc(a.title)}</b>${a.ko ? `<small>${esc(a.ko)}</small>` : ''}</span>`;
};
const albumSub = (a) => (isSong(a)
  ? [a.date.slice(0, 4), a.artist].filter(Boolean)
  : [a.date.slice(0, 4), TYPE_NAMES[a.type], `${a.tracks.length}곡`]).join(' · ');
try { state.view = localStorage.getItem('record.view') || 'shows'; } catch { /* 무시 */ }
let box = null;
const onData = () => render();

export function mount(view) {
  box = document.createElement('div');
  box.className = 'record';
  view.append(box);
  box.addEventListener('click', onClick);
  window.addEventListener('data-changed', onData);
  render();
}
export function unmount() { window.removeEventListener('data-changed', onData); box = null; }

const dateLabel = (d) => { const x = new Date(d + 'T00:00'); return `${x.getFullYear()}.${x.getMonth() + 1}.${x.getDate()} (${WD[x.getDay()]})`; };
const starsView = (n, cls = '') => `<span class="stars ${cls}" role="img" aria-label="별점 ${n || 0}점">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= (n || 0) ? 'on' : ''}">${icon('star')}</i>`).join('')}</span>`;
const starsInput = (name, n, label = '별점') => `<div class="stars-in" role="group" aria-label="${esc(label)}" data-stars="${esc(name)}" data-v="${n || 0}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-star="${i}" aria-label="${i}점" aria-pressed="${i <= (n || 0)}">${icon('star')}</button>`).join('')}</div>`;

// 별점 입력: 같은 별을 다시 누르면 0점
function bindStars(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    const g = b.closest('[data-stars]');
    const n = Number(b.dataset.star);
    const v = Number(g.dataset.v) === n ? 0 : n;
    g.dataset.v = v;
    g.querySelectorAll('[data-star]').forEach((x) => x.setAttribute('aria-pressed', Number(x.dataset.star) <= v));
    g.dispatchEvent(new CustomEvent('stars', { bubbles: true, detail: v }));
  });
}

async function render() {
  if (!box) return;
  const body = state.view === 'albums' ? await albumsHTML() : state.view === 'recap' ? await recapHTML() : await showsHTML();
  if (!box) return;
  box.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">fromis_9</p><h1>기록</h1></div>
      <button type="button" class="icon-btn" data-act="settings" aria-label="설정">${icon('gear')}</button>
    </header>
    <div class="seg seg-main rec-seg" role="group" aria-label="보기">
      ${VIEWS.map(([k, n]) => `<button type="button" data-view="${k}" aria-pressed="${state.view === k}">${n}</button>`).join('')}
    </div>
    ${body}
    ${state.view === 'shows' ? `<button type="button" class="fab" data-act="add-show" aria-label="직관 기록 추가">${icon('plus')}</button>` : ''}`;
}

/* ---------- 직관 목록 ---------- */
async function showsHTML() {
  const [shows, sug] = await Promise.all([R.getShows(), R.suggestions()]);
  const thumbs = await P.photosByIds(shows.map((s) => s.photos?.[0]).filter(Boolean));
  const tmap = new Map(thumbs.map((p) => [p.id, p]));
  const sugHTML = sug.length ? `<section class="panel rec-sug">
      <div class="panel-head"><h3>지난 일정, 기록 남길까요?</h3></div>
      <ul class="ev-list">${sug.slice(0, 3).map((e) => `<li class="sug-row">
        <span class="ev-main"><b>${esc(e.title)}</b><small>${dateLabel(e.date)}${e.memo ? ' · ' + esc(e.memo) : ''}</small></span>
        <button type="button" class="btn btn-sm btn-primary" data-sug="${esc(e.id)}">기록하기</button>
        <button type="button" class="icon-btn sm" data-sugx="${esc(e.id)}" aria-label="이 일정은 기록 안 함">${icon('x')}</button>
      </li>`).join('')}</ul>
    </section>` : '';
  if (!shows.length) {
    return `${sugHTML}<div class="empty"><div class="empty-ic">${icon('ticket')}</div><p>아직 직관 기록이 없어요</p><small>오른쪽 아래 + 버튼으로 콘서트·팬미팅·팬싸를 기록해요.</small></div>`;
  }
  const byYear = {};
  [...shows].sort((a, b) => b.date.localeCompare(a.date)).forEach((s) => (byYear[s.date.slice(0, 4)] ||= []).push(s));
  return `${sugHTML}${Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([y, list]) => `
    <section class="rec-year">
      <h2 class="rec-year-h">${y}년 <small>${list.length}회</small></h2>
      <ul class="show-list">${list.map((s) => {
        const d = new Date(s.date + 'T00:00');
        const th = tmap.get(s.photos?.[0]);
        return `<li><button type="button" class="show-card" data-show="${esc(s.id)}">
          <span class="show-date"><b>${d.getMonth() + 1}.${d.getDate()}</b><small>${WD[d.getDay()]}</small></span>
          <span class="show-main">
            <b>${esc(s.title)}</b>
            <small>${[R.KINDS[s.kind], s.place, s.seat].filter(Boolean).map(esc).join(' · ')}</small>
            ${s.rating ? starsView(s.rating, 'sm') : ''}
          </span>
          ${th ? `<span class="show-thumb" style="background-image:url(${P.photoURL(th)})" aria-hidden="true"></span>` : ''}
        </button></li>`;
      }).join('')}</ul>
    </section>`).join('')}`;
}

/* ---------- 직관 상세 ---------- */
async function openShowDetail(id) {
  const s = (await R.getShows()).find((x) => x.id === id);
  if (!s) return;
  const [photos, txs] = await Promise.all([P.photosByIds(s.photos || []), R.txByIds(s.tx || [])]);
  const spent = txs.reduce((n, t) => n + t.amount, 0);
  const sh = openSheet({
    title: s.title,
    body: `<div class="show-detail">
      ${photos.length ? `<div class="photo-strip">${photos.map((p) => `<a href="${P.photoURL(p)}" target="_blank" rel="noopener" class="ps-item"><img src="${P.photoURL(p)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      <dl class="set-meta">
        <dt>날짜</dt><dd>${dateLabel(s.date)}${s.time ? ' ' + esc(s.time) : ''}</dd>
        <dt>종류</dt><dd>${esc(R.KINDS[s.kind] || '')}</dd>
        ${s.place ? `<dt>장소</dt><dd>${esc(s.place)}</dd>` : ''}
        ${s.seat ? `<dt>좌석</dt><dd>${esc(s.seat)}</dd>` : ''}
        ${s.rating ? `<dt>별점</dt><dd>${starsView(s.rating)}</dd>` : ''}
      </dl>
      ${s.review ? `<h3 class="sub-h">후기</h3><p class="review-text">${esc(s.review)}</p>` : ''}
      ${s.setlist?.length ? `<h3 class="sub-h">세트리스트 <small>${s.setlist.length}곡</small></h3><ol class="setlist">${s.setlist.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
      ${txs.length ? `<h3 class="sub-h">쓴 돈 <small>${L.won(spent)}</small></h3><ul class="link-tx">${txs.map((t) => `<li><span>${esc(t.place || '지출')}<small>${t.date.slice(5).replace('-', '.')}</small></span><b>${L.won(t.amount)}</b></li>`).join('')}</ul>` : ''}
    </div>`,
    footer: `<button type="button" class="btn btn-primary" data-act="edit">${icon('edit')} 수정</button>`,
  });
  sh.foot.addEventListener('click', async () => { await sh.close(); openShowForm(id); });
}

/* ---------- 직관 추가·수정 ---------- */
async function openShowForm(id, prefill = {}) {
  const list = await R.getShows();
  const found = list.find((x) => x.id === id);
  const isNew = !found;
  const s = found ? structuredClone(found) : { id: uid(), title: '', kind: 'concert', date: today(), time: '', place: '', seat: '', rating: 0, review: '', setlist: [], photos: [], tx: [], eventId: null, ...prefill };
  const origPhotos = new Set(s.photos);
  const added = new Set();
  let saved = false;

  const sh = openSheet({
    title: isNew ? '직관 기록' : '직관 기록 수정',
    body: `<form class="form" novalidate>
      <div class="field"><label for="sh-title">공연·행사 이름</label><input id="sh-title" value="${esc(s.title)}" placeholder="예: 2026 프로미스나인 콘서트 첫콘"></div>
      <div class="field"><span class="label">종류</span><div class="chips wrap" data-kinds>${Object.entries(R.KINDS).map(([k, n]) => `<button type="button" class="chip chip-sm" data-kind="${k}" aria-pressed="${s.kind === k}">${n}</button>`).join('')}</div></div>
      <div class="field-row">
        <div class="field"><label for="sh-date">날짜</label><input id="sh-date" type="date" value="${esc(s.date)}"></div>
        <div class="field"><label for="sh-time">시간 <small>선택</small></label><input id="sh-time" type="time" value="${esc(s.time || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="sh-place">장소</label><input id="sh-place" value="${esc(s.place)}" placeholder="예: 핸드볼경기장"></div>
        <div class="field"><label for="sh-seat">좌석 <small>선택</small></label><input id="sh-seat" value="${esc(s.seat)}" placeholder="예: 플로어 B구역 3열"></div>
      </div>
      <div class="field"><span class="label">별점</span>${starsInput('show', s.rating)}</div>
      <div class="field"><label for="sh-review">후기</label><textarea id="sh-review" rows="4" placeholder="기억하고 싶은 순간, 멘트, 무대">${esc(s.review)}</textarea></div>
      <div class="field">
        <label for="sh-setlist">세트리스트 <small>한 줄에 한 곡</small></label>
        <textarea id="sh-setlist" rows="5">${esc((s.setlist || []).join('\n'))}</textarea>
        <button type="button" class="btn-link" data-act="pick-song">${icon('music')} 앨범 곡에서 고르기</button>
      </div>
      <div class="field"><span class="label">사진</span><div class="photo-edit" data-photos></div>
        <input type="file" accept="image/*" multiple hidden data-file></div>
      <div class="field"><span class="label">쓴 돈 연결 <small>가계부의 덕질 지출 (공연 45일 전 ~ 7일 뒤)</small></span><div data-tx></div></div>
    </form>`,
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  sh.onClose = async () => { if (!saved) for (const pid of added) await P.removePhoto(pid); };
  const $ = (q) => sh.body.querySelector(q);
  bindStars(sh.body);
  if (isNew && !s.title) setTimeout(() => $('#sh-title')?.focus(), 320);

  async function drawPhotos() {
    const ps = await P.photosByIds(s.photos);
    $('[data-photos]').innerHTML = `${ps.map((p) => `<span class="pe-item" style="background-image:url(${P.photoURL(p)})"><button type="button" class="pe-x" data-rmphoto="${p.id}" aria-label="사진 빼기">${icon('x')}</button></span>`).join('')}
      <button type="button" class="pe-add" data-act="add-photo" aria-label="사진 추가">${icon('camera')}<small>추가</small></button>`;
  }
  async function drawTx() {
    const txs = await R.linkableTx($('#sh-date').value, s.tx);
    const sum = txs.filter((t) => s.tx.includes(t.id)).reduce((n, t) => n + t.amount, 0);
    $('[data-tx]').innerHTML = txs.length ? `<ul class="link-tx pick">${txs.map((t) => `<li><label>
        <input type="checkbox" data-txid="${esc(t.id)}" ${s.tx.includes(t.id) ? 'checked' : ''}>
        <span>${esc(t.place || '지출')}<small>${t.date.slice(5).replace('-', '.')}${t.member ? ' · ' + esc(t.member) : ''}</small></span><b>${L.won(t.amount)}</b>
      </label></li>`).join('')}</ul><p class="hint">연결한 합계 <b>${L.won(sum)}</b></p>`
      : '<p class="hint">이 기간에 덕질 지출이 없어요. 가계부에서 티켓·굿즈 지출을 먼저 넣으면 여기서 고를 수 있어요.</p>';
  }
  await Promise.all([drawPhotos(), drawTx()]);

  sh.body.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-kind]');
    if (k) { s.kind = k.dataset.kind; sh.body.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x === k)); return; }
    const rm = e.target.closest('[data-rmphoto]');
    if (rm) { s.photos = s.photos.filter((x) => x !== rm.dataset.rmphoto); drawPhotos(); return; }
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'add-photo') $('[data-file]').click();
    if (a?.dataset.act === 'pick-song') {
      openSongPicker((track) => {
        const ta = $('#sh-setlist');
        ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + track;
      });
    }
  });
  sh.body.addEventListener('change', async (e) => {
    if (e.target.matches('[data-txid]')) {
      const tid = e.target.dataset.txid;
      s.tx = e.target.checked ? [...s.tx, tid] : s.tx.filter((x) => x !== tid);
      drawTx();
    }
    if (e.target.id === 'sh-date') drawTx();
    if (e.target.matches('[data-file]')) {
      const files = [...e.target.files];
      e.target.value = '';
      for (const f of files) {
        try { const pid = await P.addRecordPhoto(f); added.add(pid); s.photos.push(pid); } catch { toast('사진을 읽을 수 없어요'); }
      }
      drawPhotos();
    }
  });

  sh.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const cur = await R.getShows();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${s.title}' 기록을 지울까요? 사진도 함께 지워져요.`, { ok: '지우기', danger: true }))) return;
      await R.saveShows(cur.filter((x) => x.id !== s.id));
      for (const pid of new Set([...origPhotos, ...s.photos])) await P.removePhoto(pid);
      saved = true;
      await sh.close(); notifyChange(); toast('지웠어요');
      return;
    }
    const next = {
      ...s,
      title: $('#sh-title').value.trim(), date: $('#sh-date').value, time: $('#sh-time').value,
      place: $('#sh-place').value.trim(), seat: $('#sh-seat').value.trim(),
      rating: Number($('[data-stars="show"]').dataset.v) || 0, review: $('#sh-review').value.trim(),
      setlist: $('#sh-setlist').value.split('\n').map((x) => x.trim()).filter(Boolean),
    };
    if (!next.title) { toast('이름을 적어주세요'); $('#sh-title').focus(); return; }
    if (!next.date) { toast('날짜를 골라주세요'); return; }
    await R.saveShows(isNew ? [...cur, next] : cur.map((x) => (x.id === next.id ? next : x)));
    for (const pid of origPhotos) if (!next.photos.includes(pid)) await P.removePhoto(pid); // 뺀 사진 정리
    for (const pid of added) if (!next.photos.includes(pid)) await P.removePhoto(pid);
    saved = true;
    await sh.close(); notifyChange();
    toast('저장했어요');
  });
}

/* ---------- 곡 고르기 (세트리스트용) ---------- */
async function openSongPicker(onPick) {
  const albums = await R.allAlbums();
  const sh = openSheet({
    title: '곡 고르기',
    body: `<p class="hint">누르는 순서대로 세트리스트에 들어가요.</p>
      <div class="song-pick">${albums.map((a, i) => `<details${i === 0 ? ' open' : ''}><summary><b>${esc(a.title)}</b><small>${a.date.slice(0, 4)} · ${esc(TYPE_NAMES[a.type] || '')}</small></summary>
        <div class="chips wrap">${a.tracks.map((t) => `<button type="button" class="chip chip-sm" data-track="${esc(t)}">${esc(t)}</button>`).join('')}</div></details>`).join('')}</div>`,
    footer: '<button type="button" class="btn btn-primary" data-act="done">다 골랐어요</button>',
  });
  sh.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-track]');
    if (!t) return;
    onPick(t.dataset.track);
    t.setAttribute('aria-pressed', 'true');
    toast(`${t.dataset.track} 추가`);
  });
  sh.foot.addEventListener('click', () => sh.close());
}

/* ---------- 앨범 목록 ---------- */
async function albumsHTML() {
  const [all, reviews] = await Promise.all([R.allAlbums(), R.getReviews()]);
  const favs = [];
  for (const a of all) for (const [i, t] of Object.entries(reviews[a.id]?.tracks || {})) if (t.fav) favs.push({ a, t: a.tracks[i] });
  const f = state.albumFilter;
  const albums = all.filter((a) => f === 'all' || (f === 'album' ? !isSong(a) : a.type === f));
  return `
    ${favs.length ? `<section class="panel fav-panel"><div class="panel-head"><h3>${icon('heart')} 내 최애곡</h3><small class="panel-note">${favs.length}곡</small></div>
      <div class="chips wrap">${favs.map((x) => `<button type="button" class="chip chip-sm" data-album="${esc(x.a.id)}">${esc(x.t)}</button>`).join('')}</div></section>` : ''}
    <div class="chips wrap album-filter">${ALBUM_FILTERS.map(([k, n]) => `<button type="button" class="chip chip-sm" data-afilter="${k}" aria-pressed="${f === k}">${n}</button>`).join('')}</div>
    <ul class="album-grid">${albums.map((a, i) => {
      const r = reviews[a.id] || {};
      const nf = Object.values(r.tracks || {}).filter((t) => t.fav).length;
      const nr = Object.values(r.tracks || {}).filter((t) => t.rating).length;
      return `<li><button type="button" class="album-card" data-album="${esc(a.id)}">
        ${coverHTML(a, i)}
        <span class="album-meta">
          <b class="album-title">${esc(a.title)}</b>
          ${a.drama ? `<small>${esc(a.drama)}</small>` : ''}
          <small>${esc(albumSub(a))}</small>
          ${r.rating ? starsView(r.rating, 'sm') : `<small class="muted">${nr ? `${nr}곡 별점` : '아직 감상 전'}</small>`}
          ${nf ? `<small class="fav-n">${icon('heart')} ${nf}</small>` : ''}
        </span>
      </button></li>`;
    }).join('')}
      <li><button type="button" class="album-card album-add" data-act="add-album">${icon('plus')}<span>앨범 추가<small>목록에 없는 새 앨범</small></span></button></li>
    </ul>`;
}

/* ---------- 앨범 감상 ---------- */
async function openAlbum(id) {
  const albums = await R.allAlbums();
  const a = albums.find((x) => x.id === id);
  if (!a) return;
  const all = await R.getReviews();
  const r = structuredClone(all[id] || { rating: 0, review: '', tracks: {} });
  r.tracks ||= {};
  const custom = id.startsWith('c-');
  const sh = openSheet({
    title: a.title,
    body: `<div class="album-sheet">
      <div class="album-hero">
        ${coverHTML(a, 0)}
        <div><b>${esc(a.title)}</b>${a.ko ? `<small>${esc(a.ko)}</small>` : ''}
          ${a.drama ? `<small>${esc(a.drama)}</small>` : ''}${a.artist ? `<small>부른 멤버: ${esc(a.artist)}</small>` : ''}
          <small>${[dateLabel(a.date), TYPE_NAMES[a.type], isSong(a) ? '' : `${a.tracks.length}곡`].filter(Boolean).map(esc).join(' · ')}</small></div>
      </div>
      <div class="field"><span class="label">${isSong(a) ? '별점' : '앨범 별점'}</span>${starsInput('album', r.rating, '앨범 별점')}</div>
      <div class="field"><label for="al-review">감상평</label><textarea id="al-review" rows="3" placeholder="${isSong(a) ? '이 곡 느낌, 기억하고 싶은 장면' : '앨범 전체 느낌'}">${esc(r.review || '')}</textarea></div>
      <h3 class="sub-h">${isSong(a) ? '곡 · 하트 누르면 최애곡' : '수록곡'}</h3>
      <ol class="track-list">${a.tracks.map((t, i) => {
        const tr = r.tracks[i] || {};
        return `<li class="track" data-i="${i}">
          <div class="track-top">
            <span class="track-no">${i + 1}</span>
            <b class="track-name">${esc(t)}${(a.lead || []).includes(t) ? ' <em class="lead">타이틀</em>' : ''}</b>
            <button type="button" class="fav-btn" data-fav="${i}" aria-pressed="${!!tr.fav}" aria-label="최애곡">${icon('heart')}</button>
          </div>
          ${starsInput('t' + i, tr.rating, `${t} 별점`)}
          <input class="track-note" data-note="${i}" value="${esc(tr.note || '')}" placeholder="한줄평" aria-label="${esc(t)} 한줄평">
        </li>`;
      }).join('')}</ol>
    </div>`,
    footer: `${custom ? `<button type="button" class="btn" data-act="edit-album">${icon('edit')} 앨범 정보</button>` : ''}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  bindStars(sh.body);
  sh.body.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (!f) return;
    const i = f.dataset.fav;
    const tr = (r.tracks[i] ||= {});
    tr.fav = !tr.fav;
    tr.favAt = tr.fav ? today() : '';
    f.setAttribute('aria-pressed', tr.fav);
  });
  sh.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'edit-album') { await sh.close(); openCustomAlbumForm(a); return; }
    r.rating = Number(sh.body.querySelector('[data-stars="album"]').dataset.v) || 0;
    r.review = sh.body.querySelector('#al-review').value.trim();
    a.tracks.forEach((_, i) => {
      const tr = (r.tracks[i] ||= {});
      tr.rating = Number(sh.body.querySelector(`[data-stars="t${i}"]`).dataset.v) || 0;
      tr.note = sh.body.querySelector(`[data-note="${i}"]`).value.trim();
      if (!tr.rating && !tr.note && !tr.fav) delete r.tracks[i];
    });
    r.updatedAt = today();
    const cur = await R.getReviews();
    if (!r.rating && !r.review && !Object.keys(r.tracks).length) delete cur[id]; else cur[id] = r;
    await R.saveReviews(cur);
    await sh.close(); notifyChange(); toast('저장했어요');
  });
}

async function openCustomAlbumForm(found) {
  const isNew = !found;
  const a = found ? { ...found } : { id: 'c-' + uid(), title: '', type: 'etc', date: today(), lead: [], tracks: [] };
  const sh = openSheet({
    title: isNew ? '앨범 추가' : '앨범 정보',
    body: `<form class="form" novalidate>
      <div class="field"><label for="ca-title">앨범 이름</label><input id="ca-title" value="${esc(a.title)}"></div>
      <div class="field-row">
        <div class="field"><label for="ca-date">발매일</label><input id="ca-date" type="date" value="${esc(a.date)}"></div>
        <div class="field"><label for="ca-type">종류</label><select id="ca-type">${Object.entries(TYPE_NAMES).map(([k, n]) => `<option value="${k}"${a.type === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="ca-tracks">수록곡 <small>한 줄에 한 곡, 순서대로</small></label><textarea id="ca-tracks" rows="7">${esc(a.tracks.join('\n'))}</textarea></div>
      <div class="field"><label for="ca-lead">타이틀곡 <small>선택</small></label><input id="ca-lead" value="${esc((a.lead || []).join(', '))}"></div>
    </form>`,
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const $ = (q) => sh.body.querySelector(q);
  sh.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const cur = await R.getCustomAlbums();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${a.title}' 앨범과 감상 기록을 지울까요?`, { ok: '지우기', danger: true }))) return;
      await R.saveCustomAlbums(cur.filter((x) => x.id !== a.id));
      const rv = await R.getReviews(); delete rv[a.id]; await R.saveReviews(rv);
      await sh.close(); notifyChange(); return;
    }
    const next = {
      ...a, title: $('#ca-title').value.trim(), date: $('#ca-date').value, type: $('#ca-type').value,
      tracks: $('#ca-tracks').value.split('\n').map((x) => x.trim()).filter(Boolean),
      lead: $('#ca-lead').value.split(',').map((x) => x.trim()).filter(Boolean),
    };
    if (!next.title) { toast('앨범 이름을 적어주세요'); return; }
    if (!next.date) { toast('발매일을 골라주세요'); return; }
    if (!next.tracks.length) { toast('수록곡을 한 곡 이상 적어주세요'); return; }
    await R.saveCustomAlbums(isNew ? [...cur, next] : cur.map((x) => (x.id === next.id ? next : x)));
    await sh.close(); notifyChange(); toast('저장했어요');
  });
}

/* ---------- 연말 결산 ---------- */
async function recapHTML() {
  const years = await R.recapYears();
  if (!years.includes(state.year)) state.year = years[0];
  const [x, subs, mphotos] = await Promise.all([R.recap(state.year), L.getList('subs'), P.memberPhotos()]);
  const photos = await P.photosByIds(x.photos);
  const memberRows = MEMBERS.map((m) => ({ m, v: x.byMember[m] || 0 })).filter((r) => r.v).sort((a, b) => b.v - a.v);
  const maxM = Math.max(1, ...memberRows.map((r) => r.v));
  const topSubs = Object.entries(x.bySub).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const kinds = Object.entries(x.byKind).map(([k, n]) => `${R.KINDS[k] || k} ${n}`).join(' · ');
  return `
    <div class="chips wrap rec-years">${years.map((y) => `<button type="button" class="chip chip-sm" data-year="${y}" aria-pressed="${y === state.year}">${y}</button>`).join('')}</div>
    <article class="recap-card">
      <header class="recap-head"><p class="eyebrow">fromis_9 · flover</p><h2>${state.year} 덕질 결산</h2></header>
      ${photos.length ? `<div class="recap-photos n${Math.min(photos.length, 6)}">${photos.map((p) => `<span style="background-image:url(${P.photoURL(p)})"></span>`).join('')}</div>` : ''}
      <div class="recap-stats">
        <div><span>직관</span><b>${x.shows.length}<small>회</small></b>${kinds ? `<small>${esc(kinds)}</small>` : ''}</div>
        <div><span>덕질에 쓴 돈</span><b>${L.won(x.fandomTotal)}</b><small>${x.fandomCount}건${x.showSpend ? ` · 직관 ${L.won(x.showSpend)}` : ''}</small></div>
      </div>
      ${x.best ? `<section class="recap-sec"><h3>올해 최고의 직관</h3>
        <button type="button" class="recap-best" data-show="${esc(x.best.id)}"><b>${esc(x.best.title)}</b><small>${dateLabel(x.best.date)}${x.best.place ? ' · ' + esc(x.best.place) : ''}</small>${starsView(x.best.rating, 'sm')}</button></section>` : ''}
      ${memberRows.length ? `<section class="recap-sec"><h3>멤버별 지출</h3><ul class="bars">${memberRows.map((r) => `
        <li><span class="bar-name">${avatarHTML(r.m, mphotos[r.m])}${esc(r.m)}</span><span class="bar-track"><span style="width:${(r.v / maxM) * 100}%"></span></span><b>${L.won(r.v)}</b></li>`).join('')}</ul></section>` : ''}
      ${topSubs.length ? `<section class="recap-sec"><h3>가장 많이 쓴 곳</h3><ol class="recap-rank">${topSubs.map(([k, v]) => `<li><span>${esc(L.nameOf(subs, k, '기타'))}</span><b>${L.won(v)}</b></li>`).join('')}</ol></section>` : ''}
      ${x.favs.length ? `<section class="recap-sec"><h3>올해의 최애곡</h3><ol class="recap-rank">${x.favs.slice(0, 5).map((f) => `<li><span>${esc(f.track)}<small>${esc(f.album)}</small></span>${f.rating ? starsView(f.rating, 'sm') : ''}</li>`).join('')}</ol></section>` : ''}
      ${x.rated.length ? `<section class="recap-sec"><h3>별점 매긴 앨범</h3><ol class="recap-rank">${x.rated.slice(0, 3).map((r) => `<li><span>${esc(r.album.title)}</span>${starsView(r.rating, 'sm')}</li>`).join('')}</ol></section>` : ''}
      ${!x.shows.length && !x.fandomTotal && !x.favs.length ? '<p class="hint pad">아직 이 해의 기록이 없어요. 직관 기록·덕질 지출·최애곡이 쌓이면 여기에 모여요.</p>' : ''}
    </article>`;
}

/* ---------- 클릭 ---------- */
async function onClick(e) {
  const v = e.target.closest('[data-view]');
  if (v) { state.view = v.dataset.view; try { localStorage.setItem('record.view', state.view); } catch { /* 무시 */ } render(); return; }
  const af = e.target.closest('[data-afilter]');
  if (af) { state.albumFilter = af.dataset.afilter; render(); return; }
  const y = e.target.closest('[data-year]');
  if (y) { state.year = y.dataset.year; render(); return; }
  const sh = e.target.closest('[data-show]');
  if (sh) { openShowDetail(sh.dataset.show); return; }
  const al = e.target.closest('[data-album]');
  if (al) { openAlbum(al.dataset.album); return; }
  const sg = e.target.closest('[data-sug]');
  if (sg) {
    const ev = (await (await import('./schedule-data.js')).getEvents()).find((x) => x.id === sg.dataset.sug);
    const kind = /팬싸|사인|영통/.test(ev?.title) ? 'fansign' : /팬미팅|팬밋/.test(ev?.title) ? 'fanmeeting' : /콘서트|콘$|콘\s/.test(ev?.title) ? 'concert' : 'event';
    if (ev) openShowForm(null, { title: ev.title, kind, date: ev.date, time: ev.time || '', place: ev.memo || '', eventId: ev.id });
    return;
  }
  const sx = e.target.closest('[data-sugx]');
  if (sx) { await R.dismiss(sx.dataset.sugx); render(); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  if (a.dataset.act === 'settings') openSettings();
  if (a.dataset.act === 'add-show') openShowForm(null);
  if (a.dataset.act === 'add-album') openCustomAlbumForm(null);
}
