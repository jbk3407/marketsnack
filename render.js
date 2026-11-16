// post.json -> out/01..04.png (1080x1350) + out/caption.txt. 의존성 없음(Chrome headless).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const post = JSON.parse(fs.readFileSync(path.join(__dirname, 'post.json'), 'utf8'));
const out = path.join(__dirname, 'out');
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'chromium');
const HANDLE = process.env.IG_HANDLE || '@sihwang.snack';

// 검증: 글자 넘침을 막는 길이 상한
const errs = [];
const len = (s, max, w) => (typeof s === 'string' && s.length && s.length <= max) || errs.push(`${w}: 1~${max}자 (현재 ${s && s.length})`);
len(post.label, 12, 'label'); len(post.date, 24, 'date'); len(post.headline, 34, 'headline');
if (!Array.isArray(post.items) || post.items.length !== 8) errs.push('items 는 8개 (코스피·코스닥·다우·나스닥·S&P500·금·WTI·브렌트)');
else post.items.forEach((i, k) => { len(i.name, 8, `items[${k}].name`); len(i.pct, 8, `items[${k}].pct`); len(i.value, 12, `items[${k}].value`); });
for (const r of ['kr', 'us']) {
  const s = post[r] || {};
  len(s.story, 140, `${r}.story`);
  if (!Array.isArray(s.news) || s.news.length < 2 || s.news.length > 3) errs.push(`${r}.news 는 2~3개`);
  else s.news.forEach((n, k) => len(n, 36, `${r}.news[${k}]`));
}
if (errs.length) { console.error('post.json 검증 실패:\n- ' + errs.join('\n- ')); process.exit(1); }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const dir = p => (/^[▲+]/.test(p) ? 'up' : /^[▼-]/.test(p) ? 'down' : '');
const CSS = `*{margin:0;box-sizing:border-box}body{width:1080px;height:1350px;overflow:hidden;background:#FCFCFB;color:#2E2C27;
font-family:'Malgun Gothic','Noto Sans KR',sans-serif;word-break:keep-all;position:relative;padding:100px 90px}
.k{font-size:34px;font-weight:700;color:#C6613F;letter-spacing:.02em}.up{color:#C6613F}.down{color:#4A6B8A}
h1{font-size:92px;line-height:1.28;font-weight:900;margin-top:40px}h2{font-size:56px;font-weight:900;margin:26px 0 40px}
.foot{position:absolute;left:90px;right:90px;bottom:70px;display:flex;justify-content:space-between;font-size:30px;font-weight:700;color:#B4B3A8}
.row{display:flex;justify-content:space-between;align-items:baseline;padding:22px 0;border-bottom:2px solid #E4E3DC;font-size:44px;font-weight:700}
.row b{font-size:50px}.row small{font-size:34px;color:#6B6A63;font-weight:700;margin-left:18px}.row small.up{color:#C6613F}.row small.down{color:#4A6B8A}
.story{font-size:44px;line-height:1.6;margin-bottom:46px}ul{list-style:none;padding:0}
li{font-size:34px;line-height:1.45;padding:22px 0;border-top:2px solid #E4E3DC;color:#6B6A63}li:before{content:'•  ';color:#C6613F}
.band{position:absolute;left:0;top:0;bottom:0;width:26px;background:#C6613F}`;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const page = (n, body) => {
  const f = path.join(out, `_p${n}.html`);
  fs.writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body><div class="band"></div>${body}<div class="foot"><span>${HANDLE}</span><span>${n}/4</span></div></body>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-sandbox',
    '--window-size=1080,1350', `--screenshot=${path.join(out, `0${n}.png`)}`, 'file:///' + f.replace(/\\/g, '/').replace(/^\//, '')], { stdio: 'ignore' });
  fs.unlinkSync(f);
};
const side = (k, t) => `<div class="k">${k}</div><h2>${t}</h2>`;
page(1, `<div class="k">${esc(post.date)} · ${esc(post.label)}</div><h1>${esc(post.headline)}</h1>
  <div style="position:absolute;bottom:170px;left:90px;font-size:38px;color:#6B6A63">밀어서 오늘의 시황 보기 →</div>`);
page(2, side('MARKET', '오늘의 숫자') + post.items.map(i => `<div class="row"><span>${esc(i.name)}</span><span><b>${esc(i.value)}</b><small class="${dir(i.pct)}">${esc(i.pct)}</small></span></div>`).join(''));
for (const [n, r, t] of [[3, 'kr', '국내, 왜 움직였나'], [4, 'us', '미국, 왜 움직였나']])
  page(n, side(r === 'kr' ? 'KOREA' : 'U.S.', t) + `<p class="story">${esc(post[r].story)}</p><ul>${post[r].news.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
const tick = post.items.map(i => `${i.name} ${i.pct}`).join(' / ');
fs.writeFileSync(path.join(out, 'caption.txt'), `${post.headline}\n\n${tick}\n\n${post.kr.story}\n\n${post.us.story}\n\n` +
  `※ 참고용 정보이며 투자 권유가 아닙니다. 수치는 게시 시점 기준 보도 자료입니다.\n\n#시황 #주식 #코스피 #나스닥 #증시 #경제뉴스 #금값 #유가 #미국증시 #오늘의증시\n`);
console.log('OK out/01~04.png');
