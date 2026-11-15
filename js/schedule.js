// 일정 탭: 다가오는 D-day + 달력 + 선택한 날 / 다가오는 일정
import { icon, esc, uid, openSheet, toast, confirmSheet, today } from './ui.js';
import { notifyChange } from './data.js';
import * as S from './schedule-data.js';
import * as P from './photos.js';
import { avatarHTML } from './decor-settings.js';
import { openSettings } from './settings.js';
import * as WL from './wallpaper-link.js';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const SRC = { mine: '내 일정', anniv: '기념일', apply: '응모 마감', pay: '납부' };
const pad = (n) => String(n).padStart(2, '0');
const state = { ym: today().slice(0, 7), sel: today() };
let box = null;
const onData = () => render();

export function mount(view) {
  box = document.createElement('div');
  box.className = 'schedule';
  view.append(box);
  box.addEventListener('click', onClick);
  window.addEventListener('data-changed', onData);
  render();
}
export function unmount() { window.removeEventListener('data-changed', onData); box = null; }

const dateLabel = (d) => { const x = new Date(d + 'T00:00'); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${WD[x.getDay()]})`; };
const shiftYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

async function render() {
  if (!box) return;
  const [y, m] = state.ym.split('-').map(Number);
  const first = `${state.ym}-01`;
  const last = `${state.ym}-${pad(new Date(y, m, 0).getDate())}`;
  const [monthItems, up, next, banner, mphotos, wl] = await Promise.all([
    S.itemsBetween(first, last), S.upcoming(30), S.nextDday(), P.pickBanner(), P.memberPhotos(),
    WL.supported() ? WL.status() : { state: 'none' },
  ]);
  if (!box) return;
  const t = today();
  const byDay = {};
  for (const it of monthItems) (byDay[it.date] ||= []).push(it);
  const selItems = state.sel.startsWith(state.ym) ? byDay[state.sel] || [] : await S.itemsBetween(state.sel, state.sel);

  // 달력 칸
  const startW = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startW; i++) cells.push('<span class="cal-cell blank"></span>');
  for (let d = 1; d <= days; d++) {
    const date = `${state.ym}-${pad(d)}`;
    const items = byDay[date] || [];
    const bdMember = items.find((x) => x.src === 'anniv' && x.ref.startsWith('bd-'))?.title.split(' ')[0];
    const dots = [...new Set(items.map((x) => x.src))].filter((s) => !(s === 'anniv' && bdMember)).slice(0, 3)
      .map((s) => `<i class="dot d-${s}"></i>`).join('');
    const wd = (startW + d - 1) % 7;
    cells.push(`<button type="button" class="cal-cell${date === t ? ' today' : ''}${date === state.sel ? ' sel' : ''}${wd === 0 ? ' sun' : ''}" data-day="${date}" aria-label="${dateLabel(date)}${items.length ? ` 일정 ${items.length}개` : ''}" aria-pressed="${date === state.sel}">
      <span class="cal-num">${d}</span>
      <span class="cal-marks">${bdMember ? avatarHTML(bdMember, mphotos[bdMember], 'xs') : ''}${dots}</span>
    </button>`);
  }

  const row = (it, withD) => {
    const d = S.dayDiff(t, it.date);
    const click = it.src === 'anniv' ? '' : ` data-item="${it.src}" data-ref="${esc(it.ref)}"`;
    return `<li><${click ? 'button type="button"' : 'div'} class="ev-row src-${it.src}"${click}>
      ${withD ? `<span class="ev-d">${S.dText(d)}</span>` : `<span class="ev-time">${esc(it.time || '')}</span>`}
      <span class="ev-main"><b>${esc(it.title)}</b><small>${[withD ? dateLabel(it.date) + (it.time ? ' ' + it.time : '') : '', it.sub, SRC[it.src]].filter(Boolean).map(esc).join(' · ')}</small></span>
      <i class="dot d-${it.src}" aria-hidden="true"></i>
    </${click ? 'button' : 'div'}></li>`;
  };

  const hero = next ? `<section class="dday-card${banner ? ' has-photo' : ''}">
      ${banner ? `<div class="hero-bg" style="background-image:url(${P.photoURL(banner)})" aria-hidden="true"></div>` : ''}
      <div class="dday-inner">
        <b class="dday-num">${S.dText(next.d)}</b>
        <div class="dday-text"><p>${esc(next.title)}</p><small>${dateLabel(next.date)}${next.time ? ' ' + esc(next.time) : ''}${next.sub ? ' · ' + esc(next.sub) : ''}</small></div>
      </div>
    </section>` : '';

  box.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">fromis_9</p><h1>일정</h1></div>
      <button type="button" class="icon-btn" data-act="settings" aria-label="설정">${icon('gear')}</button>
    </header>
    ${wl.state === 'need' ? '<button type="button" class="wl-notice" data-act="wlre">PC 월페이퍼 연동이 잠시 멈췄어요 · <b>눌러서 다시 연결</b></button>' : ''}
    ${hero}
    <div class="schedule-grid">
      <section class="panel cal-panel">
        <div class="month-nav">
          <button type="button" class="icon-btn sm" data-act="prev" aria-label="이전 달">${icon('chevron', 'flip')}</button>
          <h2>${y}년 ${m}월</h2>
          <button type="button" class="icon-btn sm" data-act="next" aria-label="다음 달">${icon('chevron')}</button>
          ${state.ym !== t.slice(0, 7) ? '<button type="button" class="btn-link" data-act="today">오늘</button>' : ''}
        </div>
        <div class="cal-head">${WD.map((w, i) => `<span${i === 0 ? ' class="sun"' : ''}>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
        <div class="cal-legend"><span><i class="dot d-mine"></i>내 일정</span><span><i class="dot d-anniv"></i>기념일</span><span><i class="dot d-apply"></i>마감·납부</span></div>
      </section>
      <div class="schedule-side">
        <section class="panel">
          <div class="panel-head"><h3>${dateLabel(state.sel)}${state.sel === t ? ' · 오늘' : ''}</h3><button type="button" class="btn-link" data-act="add">${icon('plus')} 일정</button></div>
          ${selItems.length ? `<ul class="ev-list">${selItems.map((it) => row(it, false)).join('')}</ul>` : '<p class="hint pad">일정이 없어요.</p>'}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>다가오는 일정</h3><small class="panel-note">30일</small></div>
          ${up.length ? `<ul class="ev-list">${up.map((it) => row(it, true)).join('')}</ul>` : '<p class="hint pad">30일 안에 일정이 없어요.</p>'}
        </section>
      </div>
    </div>
    <button type="button" class="fab" data-act="add" aria-label="일정 추가">${icon('plus')}</button>`;
}

async function onClick(e) {
  const day = e.target.closest('[data-day]');
  if (day) { state.sel = day.dataset.day; render(); return; }
  const it = e.target.closest('[data-item]');
  if (it) {
    const { item, ref } = it.dataset;
    if (item === 'mine') openEventForm(ref);
    if (item === 'apply') (await import('./ledger-fandom.js')).openApplyForm(ref);
    if (item === 'pay') {
      const r = ((await (await import('./ledger-rec.js')).getRules()) || []).find((x) => x.id === ref);
      if (r) (await import('./ledger-manage.js')).openRuleForm(r.kind, r);
    }
    return;
  }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'prev') { state.ym = shiftYM(state.ym, -1); render(); }
  if (act === 'next') { state.ym = shiftYM(state.ym, 1); render(); }
  if (act === 'today') { state.ym = today().slice(0, 7); state.sel = today(); render(); }
  if (act === 'settings') openSettings();
  if (act === 'wlre') { toast((await WL.reconnect()) ? '월페이퍼에 다시 연결했어요' : '허락하지 않아서 연결하지 못했어요'); render(); }
  if (act === 'add') openEventForm(null, state.sel);
}

/* ---------- 내 일정 추가·수정 ---------- */
async function openEventForm(id, date) {
  const list = await S.getEvents();
  const found = list.find((x) => x.id === id);
  const isNew = !found;
  const ev = found ? { ...found } : { id: uid(), title: '', date: date || today(), time: '', yearly: false, memo: '' };
  const s = openSheet({
    title: isNew ? '일정 추가' : '일정 수정',
    body: `<form class="form" novalidate>
      <div class="field"><label for="ev-title">제목</label><input id="ev-title" value="${esc(ev.title)}" placeholder="예: 컴백, 콘서트 티켓팅, 팬미팅"></div>
      <div class="field-row">
        <div class="field"><label for="ev-date">날짜</label><input id="ev-date" type="date" value="${esc(ev.date)}"></div>
        <div class="field"><label for="ev-time">시간 <small>선택</small></label><input id="ev-time" type="time" value="${esc(ev.time || '')}"></div>
      </div>
      <label class="switch-row"><span>매년 반복<small>기념일처럼 매년 같은 날</small></span><input type="checkbox" class="switch" id="ev-yearly" ${ev.yearly ? 'checked' : ''}></label>
      <div class="field"><label for="ev-memo">메모 <small>선택 · 장소, 링크 등</small></label><textarea id="ev-memo" rows="3">${esc(ev.memo || '')}</textarea></div>
    </form>`,
    footer: `${isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-act="del">${icon('trash')} 삭제</button>`}<button type="button" class="btn btn-primary" data-act="save">저장</button>`,
  });
  const $ = (q) => s.body.querySelector(q);
  if (isNew) setTimeout(() => $('#ev-title')?.focus(), 320);
  s.foot.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const cur = await S.getEvents();
    if (b.dataset.act === 'del') {
      if (!(await confirmSheet(`'${ev.title}' 일정을 지울까요?`, { ok: '지우기', danger: true }))) return;
      await S.saveEvents(cur.filter((x) => x.id !== ev.id));
      await s.close(); notifyChange();
      return;
    }
    const next = { ...ev, title: $('#ev-title').value.trim(), date: $('#ev-date').value, time: $('#ev-time').value, yearly: $('#ev-yearly').checked, memo: $('#ev-memo').value.trim() };
    if (!next.title) { toast('제목을 적어주세요'); $('#ev-title').focus(); return; }
    if (!next.date) { toast('날짜를 골라주세요'); return; }
    await S.saveEvents(isNew ? [...cur, next] : cur.map((x) => (x.id === next.id ? next : x)));
    state.sel = next.date; state.ym = next.date.slice(0, 7);
    await s.close(); notifyChange();
    toast('저장했어요');
  });
}
