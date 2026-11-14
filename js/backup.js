// 백업: 모든 데이터(사진 포함)를 JSON 파일 하나로 내보내고 불러옴
import { DB, STORES } from './db.js';
import { downloadBlob, shareFile, today } from './ui.js';

const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

async function buildBackup() {
  await DB.setMeta('lastBackup', new Date().toISOString());
  const out = { app: 'fromis-app', format: 1, exportedAt: new Date().toISOString(), stores: {} };
  for (const s of STORES) {
    const rows = await DB.all(s);
    out.stores[s] = s === 'photos'
      ? await Promise.all(rows.map(async (r) => ({ id: r.id, data: await blobToDataURL(r.blob) })))
      : rows;
  }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  return { blob, filename: `덕질노트-백업-${today()}.json` };
}

export async function exportToFile() {
  const { blob, filename } = await buildBackup();
  downloadBlob(blob, filename);
}

export async function exportToShare() {
  const { blob, filename } = await buildBackup();
  return shareFile(blob, filename);
}

export async function importFromFile(file) {
  const json = JSON.parse(await file.text());
  if (json.app !== 'fromis-app' || !json.stores) throw new Error('덕질노트 백업 파일이 아니에요.');
  const photos = await Promise.all((json.stores.photos || []).map(async (p) => ({
    id: p.id, blob: await (await fetch(p.data)).blob(),
  })));
  for (const s of STORES) {
    await DB.replaceAll(s, s === 'photos' ? photos : (json.stores[s] || []));
  }
  return { photos: photos.length };
}
