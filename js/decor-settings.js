// 설정 > 꾸미기: 배너 사진, 멤버 프로필 사진
import { openSheet, toast, confirmSheet, icon, esc } from './ui.js';
import { MEMBERS, notifyChange } from './data.js';
import * as P from './photos.js';

const canPickFolder = () => 'webkitdirectory' in document.createElement('input') && !/Android|iPhone|iPad/i.test(navigator.userAgent);

export async function openBannerManager() {
  const s = openSheet({
    title: '사진 · 첫 화면',
    body: `<section class="set-group">
        <h3>첫 화면 모양</h3>
        <div class="seg layout-seg" role="group" aria-label="첫 화면 모양"></div>
        <h3 class="sub-h">사진 맞추기</h3>
        <div class="seg fit-seg" role="group" aria-label="사진 맞추기"></div>
        <p class="hint">전체 보이기: 사진을 자르지 않고, 남는 곳은 같은 사진을 흐리게 깔아요. 꽉 채우기: 화면을 꽉 채우는 대신 가장자리가 잘려요.</p>
      </section>
      <section class="set-group">
        <h3>사진 <small class="photo-count"></small></h3>
        <p class="set-note">여러 장이면 앱을 열 때마다 랜덤으로 바뀌고, 사진을 누르면 다음 사진으로 넘어가요. 멤버 생일에는 그 멤버 사진이 우선으로 나와요. 사진은 이 기기 안에만 저장돼요 (백업 파일에는 같이 들어가요).</p>
        ${canPickFolder() ? `<button type="button" class="btn btn-block folder-btn" data-act="folder">${icon('upload')} 월페이퍼 폴더 통째로 불러오기</button>
        <p class="hint folder-note">reference 폴더를 고르면 안의 사진이 전부 들어가요. 멤버 이름 폴더는 그 멤버로, 나머지(단체·유닛)는 폴더 이름으로 묶여요. 이미 넣은 사진은 건너뛰어요.</p>` : ''}
        <p class="hint import-progress" hidden></p>
        <div class="photo-filter chips" role="group"></div>
        <div class="photo-grid"></div>
      </section>
      <input type="file" accept="image/*" multiple hidden data-files>
      <input type="file" webkitdirectory multiple hidden data-folder>`,
    footer: `<button type="button" class="btn btn-primary btn-block" data-act="add">${icon('image')} 사진 골라서 추가</button>`,
  });
  const grid = s.body.querySelector('.photo-grid');
  const filterEl = s.body.querySelector('.photo-filter');
  const filesIn = s.body.querySelector('[data-files]');
  const folderIn = s.body.querySelector('[data-folder]');
  const prog = s.body.querySelector('.import-progress');
  const layoutSeg = s.body.querySelector('.layout-seg');
  let filter = '';

  const fitSeg = s.body.querySelector('.fit-seg');
  async function drawLayout() {
    const [cur, fit] = await Promise.all([P.getLayout(), P.getFit()]);
    layoutSeg.innerHTML = P.LAYOUTS.map(([v, n]) => `<button type="button" data-layout="${v}" aria-pressed="${cur === v}">${n}</button>`).join('');
    fitSeg.innerHTML = P.FITS.map(([v, n]) => `<button type="button" data-fit="${v}" aria-pressed="${fit === v}">${n}</button>`).join('');
    fitSeg.closest('section').querySelectorAll('.sub-h, .fit-seg, .fit-seg + .hint').forEach((el) => { el.hidden = cur === 'polaroid'; });
  }
  fitSeg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-fit]');
    if (!b) return;
    await P.setFit(b.dataset.fit);
    await drawLayout();
    notifyChange();
  });
  async function render() {
    const all = await P.banners();
    s.body.querySelector('.photo-count').textContent = all.length ? `${all.length}장` : '';
    const tags = [...new Set(all.map((p) => p.member || p.group || '기타'))];
    const order = (t) => { const i = MEMBERS.indexOf(t); return i < 0 ? 10 + (t === '기타') : i; };
    tags.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    if (filter && !tags.includes(filter)) filter = '';
    filterEl.innerHTML = all.length > 12 && tags.length > 1
      ? [['', '전체'], ...tags.map((t) => [t, t])].map(([v, n]) => `<button type="button" class="chip chip-sm" data-filter="${esc(v)}" aria-pressed="${filter === v}">${esc(n)}</button>`).join('')
      : '';
    const list = filter ? all.filter((p) => (p.member || p.group || '기타') === filter) : all;
    grid.innerHTML = list.length
      ? list.map((p) => `<button type="button" class="photo-thumb" data-id="${esc(p.id)}" aria-label="사진${p.member ? ' · ' + esc(p.member) : ''}">
          <img src="${P.photoURL(p)}" alt="" loading="lazy">${p.member || p.group ? `<span class="thumb-tag">${esc(p.member || p.group)}</span>` : ''}</button>`).join('')
      : '<p class="hint">아직 사진이 없어요.</p>';
  }
  await drawLayout();
  await render();

  layoutSeg.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    await P.setLayout(b.dataset.layout);
    await drawLayout();
    notifyChange();
  });
  filterEl.addEventListener('click', (e) => { const c = e.target.closest('[data-filter]'); if (c) { filter = c.dataset.filter; render(); } });
  s.body.addEventListener('click', (e) => { if (e.target.closest('[data-act="folder"]')) folderIn.click(); });
  s.foot.addEventListener('click', (e) => { if (e.target.closest('[data-act="add"]')) filesIn.click(); });

  filesIn.addEventListener('change', async () => {
    const files = [...filesIn.files];
    filesIn.value = '';
    if (!files.length) return;
    let ok = 0;
    for (const f of files) { try { await P.addBanner(f); ok++; } catch { /* 건너뜀 */ } }
    toast(ok === files.length ? `${ok}장 추가했어요` : `${ok}장 추가 (${files.length - ok}장은 못 읽었어요)`);
    P.resetBannerPick();
    notifyChange();
    render();
  });
  folderIn.addEventListener('change', async () => {
    const files = [...folderIn.files];
    folderIn.value = '';
    if (!files.length) return;
    prog.hidden = false;
    const r = await P.importFolder(files, (i, n) => { prog.textContent = `불러오는 중… ${i} / ${n}`; });
    prog.textContent = `${r.added}장 추가${r.skipped ? ` · ${r.skipped}장은 이미 있어서 건너뜀` : ''}${r.failed ? ` · ${r.failed}장은 못 읽음` : ''}${r.profiles ? ` · 멤버 프로필 ${r.profiles}명 자동 설정` : ''}`;
    toast(`${r.added}장 불러왔어요`);
    notifyChange();
    render();
  });
  grid.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = (await P.banners()).find((x) => x.id === b.dataset.id);
    if (p) editBanner(p, render);
  });
}

function editBanner(p, after) {
  let member = p.member || null;
  const s = openSheet({
    title: '배너 사진',
    body: `<img class="banner-preview" src="${P.photoURL(p)}" alt="">
      <div class="field"><span class="label">이 사진의 멤버 <small>선택 · 생일에 우선으로 나와요</small></span><div class="chips wrap"></div></div>`,
    footer: `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button><button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const chips = s.body.querySelector('.chips');
  const draw = () => {
    chips.innerHTML = [['', '없음'], ...MEMBERS.map((m) => [m, m])].map(([v, n]) =>
      `<button type="button" class="chip chip-sm" data-m="${esc(v)}" aria-pressed="${(member || '') === v}">${esc(n)}</button>`).join('');
  };
  draw();
  chips.addEventListener('click', (e) => { const c = e.target.closest('[data-m]'); if (c) { member = c.dataset.m || null; draw(); } });
  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet('이 사진을 삭제할까요?', { ok: '삭제', danger: true }))) return;
      await P.removePhoto(p.id);
    } else {
      await P.updatePhoto(p, { member });
    }
    P.resetBannerPick();
    await s.close();
    notifyChange();
    after();
  });
}

export async function openMemberPhotoManager() {
  const s = openSheet({
    title: '멤버 프로필 사진',
    body: `<p class="set-note">멤버별 지출과 입력할 때 멤버 고르는 칸에 동그랗게 나와요. 정사각형으로 잘리는데, 얼굴이 보통 위쪽에 있어서 위쪽을 기준으로 잘라요.</p>
      <ul class="member-photo-list"></ul><input type="file" accept="image/*" hidden>`,
  });
  const ul = s.body.querySelector('ul');
  const input = s.body.querySelector('input[type=file]');
  let target = null;

  async function render() {
    const mp = await P.memberPhotos();
    ul.innerHTML = MEMBERS.map((m) => `<li>
      ${avatarHTML(m, mp[m], 'lg')}
      <b>${esc(m)}</b>
      <span class="mp-actions">
        <button type="button" class="btn btn-sm" data-pick="${esc(m)}">${icon('image')} ${mp[m] ? '바꾸기' : '고르기'}</button>
        ${mp[m] ? `<button type="button" class="icon-btn sm" data-rm="${esc(m)}" aria-label="${esc(m)} 사진 빼기">${icon('x')}</button>` : ''}
      </span></li>`).join('');
  }
  await render();

  ul.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { target = pick.dataset.pick; input.click(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const p = (await P.memberPhotos())[rm.dataset.rm];
      if (p) { await P.removePhoto(p.id); notifyChange(); render(); }
    }
  });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    input.value = '';
    if (!f || !target) return;
    try { await P.setMemberPhoto(target, f); toast(`${target} 사진을 넣었어요`); } catch { toast('사진을 읽지 못했어요'); }
    notifyChange();
    render();
  });
}

// 동그란 프로필: 사진 없으면 이름 첫 글자
export function avatarHTML(member, photo, size = '') {
  return photo
    ? `<span class="avatar ${size}"><img src="${P.photoURL(photo)}" alt=""></span>`
    : `<span class="avatar ${size} no-photo m${MEMBERS.indexOf(member)}" aria-hidden="true">${esc(member.slice(-1))}</span>`;
}
