// node publish.js posts/<슬롯>  : 01~04.png 를 캐러셀로 게시. IG_DRY_RUN=1 이면 호출 없이 출력만.
const fs = require('fs'), path = require('path');
const G = 'https://graph.facebook.com/v26.0', BASE = process.env.PUBLIC_BASE || 'https://jbk3407.github.io/marketsnack';
const dir = process.argv[2], DRY = process.env.IG_DRY_RUN === '1';
const fail = m => { console.error('실패:', m); process.exit(1); };
if (!dir) fail('사용법: node publish.js posts/YYYY-MM-DD-am');
const env = { ...process.env };
if (fs.existsSync('.env')) for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !env[l.slice(0, i)]) env[l.slice(0, i)] = l.slice(i + 1).trim(); }
const { IG_TOKEN, IG_USER_ID } = env;
const imgs = fs.readdirSync(dir).filter(f => /^0\d\.png$/.test(f)).sort();
const caption = fs.readFileSync(path.join(dir, 'caption.txt'), 'utf8');
if (imgs.length !== 4) fail('이미지 4장이 아님');
if (DRY) { console.log(`[DRY] ${imgs.length}장\n${caption}`); process.exit(0); }
if (!IG_TOKEN || !IG_USER_ID) fail('.env 에 IG_TOKEN / IG_USER_ID 없음');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (m, p, params = {}) => {
  const b = new URLSearchParams({ ...params, access_token: IG_TOKEN });
  const j = await (await fetch(m === 'GET' ? `${G}/${p}?${b}` : `${G}/${p}`, m === 'GET' ? {} : { method: m, body: b })).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`); return j;
};
const ready = async id => { for (let i = 0; i < 40; i++) { const { status_code } = await api('GET', id, { fields: 'status_code' }); if (status_code === 'FINISHED') return; if (status_code === 'ERROR') throw new Error('컨테이너 오류 ' + id); await sleep(3000); } throw new Error('시간 초과 ' + id); };
(async () => {
  const url = f => `${BASE}/${dir.replace(/\\/g, '/')}/${f}`;
  for (let i = 0; ; i++) { // GitHub Pages 배포 대기(최대 10분)
    const c = await Promise.all(imgs.map(f => fetch(url(f), { method: 'HEAD' }).then(r => r.status)));
    if (c.every(x => x === 200)) break; if (i >= 60) throw new Error('공개 URL 안 열림: ' + url(imgs[0])); await sleep(10000);
  }
  const kids = []; for (const f of imgs) kids.push((await api('POST', `${IG_USER_ID}/media`, { image_url: url(f), is_carousel_item: 'true' })).id);
  for (const k of kids) await ready(k);
  const car = await api('POST', `${IG_USER_ID}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption });
  await ready(car.id);
  const { id } = await api('POST', `${IG_USER_ID}/media_publish`, { creation_id: car.id });
  const { permalink } = await api('GET', id, { fields: 'permalink' });
  fs.writeFileSync(path.join(dir, 'published.json'), JSON.stringify({ permalink, at: new Date().toISOString() }, null, 2));
  console.log('게시:', permalink);
})().catch(e => fail(e.message));
