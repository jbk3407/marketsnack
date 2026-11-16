// node publish.js posts/<슬롯>  : 01~07.png 캐러셀 → reel.mp4 릴스 순서로 게시. 각각 published.json 에 즉시 기록(재실행 시 성공한 건 다시 올리지 않음)
// IG_DRY_RUN=1 이면 API 호출 없이 무엇을 올릴지만 출력.
const fs = require('fs'), path = require('path');
const G = 'https://graph.facebook.com/v26.0', BASE = process.env.PUBLIC_BASE || 'https://jbk3407.github.io/marketsnack';
const dir = process.argv[2], DRY = process.env.IG_DRY_RUN === '1';
const fail = m => { console.error('실패:', m); process.exit(1); };
if (!dir) fail('사용법: node publish.js posts/YYYY-MM-DD-am');
const env = { ...process.env };
if (!DRY && fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !env[l.slice(0, i)]) env[l.slice(0, i)] = l.slice(i + 1).trim(); }
const { IG_TOKEN, IG_USER_ID } = env;
const imgs = fs.readdirSync(dir).filter(f => /^0\d\.png$/.test(f)).sort();
const need = [...imgs, 'caption.txt', 'reel.mp4', 'reel-cover.png', 'reel-caption.txt'];
if (imgs.length !== 7) fail(`캐러셀 이미지가 7장이 아님 (${imgs.length})`);
for (const f of need) if (!fs.existsSync(path.join(dir, f))) fail(`${f} 없음`);
const rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
const recFile = path.join(dir, 'published.json');
const rec = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : {};
const save = () => fs.writeFileSync(recFile, JSON.stringify({ ...rec, at: new Date().toISOString() }, null, 2));
if (DRY) { console.log(`[DRY] 캐러셀 ${imgs.length}장\n${rd('caption.txt')}\n[DRY] 릴스 reel.mp4\n${rd('reel-caption.txt')}`); process.exit(0); }
if (!IG_TOKEN || !IG_USER_ID) fail('.env 에 IG_TOKEN / IG_USER_ID 없음');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (m, p, params = {}) => {
  const b = new URLSearchParams({ ...params, access_token: IG_TOKEN });
  const j = await (await fetch(m === 'GET' ? `${G}/${p}?${b}` : `${G}/${p}`, m === 'GET' ? {} : { method: m, body: b })).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`); return j;
};
const ready = async id => { for (let i = 0; i < 60; i++) { const { status_code, status } = await api('GET', id, { fields: 'status_code,status' }); if (status_code === 'FINISHED') return; if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`컨테이너 ${id}: ${status}`); await sleep(5000); } throw new Error('시간 초과 ' + id); };
const publish = async id => { await ready(id); const { id: m } = await api('POST', `${IG_USER_ID}/media_publish`, { creation_id: id }); return (await api('GET', m, { fields: 'permalink' })).permalink; };
(async () => {
  const url = f => `${BASE}/${dir.replace(/\\/g, '/')}/${f}`;
  for (let i = 0; ; i++) { // GitHub Pages 배포 대기(최대 10분)
    const c = await Promise.all(need.filter(f => /\.(png|mp4)$/.test(f)).map(f => fetch(url(f), { method: 'HEAD' }).then(r => r.status)));
    if (c.every(x => x === 200)) break; if (i >= 60) throw new Error('공개 URL 안 열림: ' + url(imgs[0])); await sleep(10000);
  }
  if (!rec.carousel) {
    const kids = []; for (const f of imgs) kids.push((await api('POST', `${IG_USER_ID}/media`, { image_url: url(f), is_carousel_item: 'true' })).id);
    for (const k of kids) await ready(k);
    const car = await api('POST', `${IG_USER_ID}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: rd('caption.txt') });
    rec.carousel = await publish(car.id); save(); console.log('캐러셀 게시:', rec.carousel);
  }
  if (!rec.reel) {
    const base = { media_type: 'REELS', video_url: url('reel.mp4'), caption: rd('reel-caption.txt'), share_to_feed: 'true' };
    let reel;
    try { reel = await api('POST', `${IG_USER_ID}/media`, { ...base, cover_url: url('reel-cover.png') }); }
    catch (e) { console.log('cover_url 거부, 첫 프레임 커버로 진행:', e.message); reel = await api('POST', `${IG_USER_ID}/media`, base); }
    rec.reel = await publish(reel.id); save(); console.log('릴스 게시:', rec.reel);
  }
})().catch(e => { rec.error = e.message; if (rec.carousel || rec.reel) save(); fail(e.message); });
