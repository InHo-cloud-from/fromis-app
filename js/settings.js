import { DB } from './db.js';
import { openSheet, confirmSheet, toast, icon, esc, canShareFiles, today } from './ui.js';
import { notifyChange } from './data.js';
import { openListManager, openBudgetEditor } from './ledger-settings.js';
import { openBannerManager, openMemberPhotoManager } from './decor-settings.js';
import { exportToFile, exportToShare, importFromFile } from './backup.js';

const fmtDate = (iso) => {
  if (!iso) return '아직 없음';
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};
const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(1)}MB`;

export async function openSettings() {
  const s = openSheet({ title: '설정', body: '<div class="settings"></div>' });
  const box = s.body.firstElementChild;

  async function render() {
    const last = await DB.getMeta('lastBackup');
    let storage = '';
    try {
      const est = await navigator.storage.estimate();
      const persisted = await navigator.storage.persisted();
      storage = `${fmtMB(est.usage || 0)} 사용 중 · ${persisted ? '영구 보존 켜짐' : '영구 보존 꺼짐'}`;
    } catch { storage = '확인 불가'; }

    box.innerHTML = `
      <section class="set-group">
        <h3>백업</h3>
        <p class="set-note">데이터는 이 기기의 브라우저 안에만 있어요. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니 가끔 백업 파일을 저장해 두세요.</p>
        <dl class="set-meta"><dt>마지막 백업</dt><dd>${fmtDate(last)}</dd><dt>저장공간</dt><dd>${esc(storage)}</dd></dl>
        <div class="btn-col">
          <button type="button" class="btn btn-primary" data-act="export">${icon('download')} 백업 파일 저장</button>
          ${canShareFiles() ? `<button type="button" class="btn" data-act="share">${icon('share')} 다른 앱으로 보내기 (드라이브·카톡 등)</button>` : ''}
          <button type="button" class="btn" data-act="import">${icon('upload')} 백업 파일 불러오기</button>
          <input type="file" accept="application/json,.json" hidden data-file>
        </div>
      </section>
      <section class="set-group">
        <h3>꾸미기</h3>
        <button type="button" class="set-row" data-act="banners"><span>사진 · 첫 화면 모양</span>${icon('chevron')}</button>
        <button type="button" class="set-row" data-act="members"><span>멤버 프로필 사진</span>${icon('chevron')}</button>
      </section>
      <section class="set-group">
        <h3>가계부</h3>
        <button type="button" class="set-row" data-act="budget"><span>예산</span>${icon('chevron')}</button>
        <button type="button" class="set-row" data-list="cats"><span>지출 분류</span>${icon('chevron')}</button>
        <button type="button" class="set-row" data-list="subs"><span>덕질 항목</span>${icon('chevron')}</button>
        <button type="button" class="set-row" data-list="pays"><span>결제수단</span>${icon('chevron')}</button>
        <button type="button" class="set-row" data-list="incomeKinds"><span>수입 구분</span>${icon('chevron')}</button>
      </section>`;
  }
  await render();

  box.addEventListener('click', async (e) => {
    const li = e.target.closest('[data-list]');
    if (li) { openListManager(li.dataset.list); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'export') { await exportToFile(); toast('백업 파일을 저장했어요'); render(); }
    if (act === 'share') { if (await exportToShare()) render(); }
    if (act === 'import') box.querySelector('[data-file]').click();
    if (act === 'budget') openBudgetEditor(today().slice(0, 7));
    if (act === 'banners') openBannerManager();
    if (act === 'members') openMemberPhotoManager();
  });

  box.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-file]')) return;
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ok = await confirmSheet('지금 앱에 있는 데이터가 모두 백업 파일 내용으로 바뀌어요. 계속할까요?', { ok: '불러오기', danger: true });
    if (!ok) return;
    try {
      await importFromFile(file);
      toast('불러오기 완료');
      notifyChange();
      render();
    } catch (err) {
      toast(err.message.includes('덕질노트') ? err.message : '파일을 읽을 수 없어요');
    }
  });
}
