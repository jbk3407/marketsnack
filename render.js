// post.json -> out/01..07.png (캐러셀 1080x1350) + out/reel/r1..r4.png (릴스 1080x1920) + out/caption.txt + out/reel-caption.txt
// 순서: 1 표지 / 2 국내 뉴스 / 3 미국 뉴스 / 4 국내 왜 / 5 미국 왜 / 6 오늘의 숫자 / 7 금·유가
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const post = JSON.parse(fs.readFileSync(process.env.POST_FILE || path.join(__dirname, 'post.json'), 'utf8'));
const out = path.join(__dirname, 'out');
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'chromium');
const HANDLE = process.env.IG_HANDLE || '@sihwang.snack';

// 검증: 글자 넘침을 막는 길이 상한
const errs = [];
const len = (s, max, w) => (typeof s === 'string' && s.length && s.length <= max) || errs.push(`${w}: 1~${max}자 (현재 ${s && s.length})`);
len(post.label, 12, 'label'); len(post.date, 24, 'date'); len(post.headline, 30, 'headline');
if (!Array.isArray(post.items) || post.items.length !== 8) errs.push('items 는 8개 (코스피·코스닥·다우·나스닥·S&P500·금·WTI·브렌트)');
else post.items.forEach((i, k) => { len(i.name, 8, `items[${k}].name`); len(i.pct, 8, `items[${k}].pct`); len(i.value, 12, `items[${k}].value`); });
for (const r of ['kr', 'us']) {
  const s = post[r] || {};
  len(s.key, 22, `${r}.key`); len(s.story, 200, `${r}.story`);
  if (!Array.isArray(s.points) || s.points.length !== 3) errs.push(`${r}.points 는 3개`);
  else s.points.forEach((p, k) => len(p, 24, `${r}.points[${k}]`));
  if (!Array.isArray(s.news) || s.news.length < 3 || s.news.length > 5) errs.push(`${r}.news 는 3~5개`);
  else s.news.forEach((n, k) => {
    len(n.t, 22, `${r}.news[${k}].t`); len(n.d, 46, `${r}.news[${k}].d`);
    if (!['up', 'down', 'flat'].includes(n.s)) errs.push(`${r}.news[${k}].s 는 up|down|flat`);
    if (!/^https?:\/\/\S+$/.test(n.u || '')) errs.push(`${r}.news[${k}].u 는 기사 URL(https://...)`);
  });
}
len((post.commodity || {}).story, 150, 'commodity.story');
if (errs.length) { console.error('post.json 검증 실패:\n- ' + errs.join('\n- ')); process.exit(1); }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const dir = p => (/^[▲+]/.test(p) ? 'up' : /^[▼-]/.test(p) ? 'down' : 'flat');
const ARROW = { up: '▲', down: '▼', flat: '●' };
const it = n => post.items.find(i => i.name === n) || post.items[0];
const UP = '#E5383B', DOWN = '#2F6FDE';
const CSS = `*{margin:0;box-sizing:border-box}body{overflow:hidden;background:#FCFCFB;color:#1F1F24;
font-family:'Malgun Gothic','Noto Sans KR',sans-serif;word-break:keep-all;position:relative}
.up{color:${UP}}.down{color:${DOWN}}.flat{color:#8A8A92}
.bg-up{background:#FDECEC}.bg-down{background:#EAF1FD}.bg-flat{background:#F0F0F2}
.k{font-size:32px;font-weight:900;letter-spacing:.04em;color:#8A8A92}
h2{font-size:64px;font-weight:900;margin:14px 0 34px;line-height:1.2}
.foot{position:absolute;left:80px;right:80px;bottom:60px;display:flex;justify-content:space-between;font-size:28px;font-weight:700;color:#B4B3A8}
.hero{border-radius:36px;padding:34px 44px;margin-bottom:34px}
.hero .n{font-size:38px;font-weight:900}.hero .p{font-size:150px;line-height:1.05;font-weight:900;letter-spacing:-.02em}
.hero .v{font-size:36px;font-weight:700;color:#55555C;margin-top:4px}
.key{font-size:66px;font-weight:900;line-height:1.22;margin-bottom:34px}
.pt{display:flex;align-items:center;gap:26px;padding:22px 0;border-top:3px solid #ECECEF;font-size:42px;font-weight:700;line-height:1.3}
.pt i{flex:none;width:68px;height:68px;border-radius:50%;color:#fff;font-style:normal;font-size:38px;font-weight:900;display:flex;align-items:center;justify-content:center}
.nw{display:flex;gap:26px;padding:19px 0;border-top:3px solid #ECECEF}
.nw .bd{flex:none;width:76px;height:76px;border-radius:22px;font-size:40px;font-weight:900;display:flex;align-items:center;justify-content:center}
.nw b{display:block;font-size:42px;line-height:1.28;font-weight:900}.nw span{display:block;font-size:29px;line-height:1.42;color:#6B6A73;margin-top:5px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.tile{border-radius:30px;padding:26px 32px;height:206px}
.tile .n{font-size:34px;font-weight:900}.tile .p{font-size:68px;font-weight:900;line-height:1.15}.tile .v{font-size:32px;font-weight:700;color:#55555C}
.cm{display:flex;align-items:center;gap:30px;border-radius:30px;padding:26px 36px;margin-bottom:20px;height:178px}
.cm .e{font-size:78px}.cm .n{font-size:40px;font-weight:900;flex:1}.cm .p{font-size:70px;font-weight:900;text-align:right;line-height:1.1}.cm .v{font-size:32px;font-weight:700;color:#55555C;text-align:right}
.say{font-size:44px;line-height:1.5;font-weight:700;margin-top:34px}
.dark{background:#15161B;color:#fff}.dark .k{color:#9A9AA6}.dark .foot{color:#6B6B76}`;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'reel'), { recursive: true });
const shot = (file, w, h, html, cls, pad) => {
  const f = file.replace(/\.png$/, '.html');
  fs.writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>${CSS}body{width:${w}px;height:${h}px;padding:${pad}}</style><body class="${cls}">${html}</body>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-sandbox',
    `--window-size=${w},${h}`, `--screenshot=${file}`, 'file:///' + f.replace(/\\/g, '/').replace(/^\//, '')], { stdio: 'ignore' });
  fs.unlinkSync(f);
};
const page = (n, body, cls = '') => shot(path.join(out, `0${n}.png`), 1080, 1350,
  body + `<div class="foot"><span>${HANDLE}</span><span>${n}/7</span></div>`, cls, '96px 80px');
const head = (k, t) => `<div class="k">${k}</div><h2>${t}</h2>`;
const hero = i => { const d = dir(i.pct); return `<div class="hero bg-${d}"><div class="n">${esc(i.name)}</div><div class="p ${d}">${esc(i.pct)}</div><div class="v">${esc(i.value)}</div></div>`; };
const tile = i => { const d = dir(i.pct); return `<div class="tile bg-${d}"><div class="n">${esc(i.name)}</div><div class="p ${d}">${esc(i.pct)}</div><div class="v">${esc(i.value)}</div></div>`; };
const news = a => a.map(x => `<div class="nw"><div class="bd bg-${x.s} ${x.s}">${ARROW[x.s]}</div><div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div></div>`).join('');
const why = (r, i) => { const d = dir(i.pct); const c = d === 'up' ? UP : d === 'down' ? DOWN : '#8A8A92';
  return hero(i) + `<div class="key">${esc(post[r].key)}</div>` + post[r].points.map((p, k) => `<div class="pt"><i style="background:${c}">${k + 1}</i><span>${esc(p)}</span></div>`).join(''); };
const lite = d => (d === 'up' ? '#FF6B6B' : d === 'down' ? '#6AA2FF' : '#aaa');

const kp = it('코스피'), nq = it('나스닥');
// ───────── 캐러셀
page(1, `<div class="k">${esc(post.date)} · ${esc(post.label)}</div>
  <div style="font-size:98px;font-weight:900;line-height:1.24;margin:44px 0 54px">${esc(post.headline)}</div>
  <div class="grid">${[kp, nq].map(i => { const d = dir(i.pct); return `<div style="border-radius:30px;padding:30px 34px;background:#23242C"><div style="font-size:34px;font-weight:900;color:#B8B8C4">${esc(i.name)}</div><div style="font-size:78px;font-weight:900;line-height:1.15;color:${lite(d)}">${esc(i.pct)}</div><div style="font-size:30px;color:#B8B8C4;font-weight:700">${esc(i.value)}</div></div>`; }).join('')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:22px">${post.items.filter(i => i !== kp && i !== nq).map(i => { const d = dir(i.pct); return `<div style="border-radius:22px;padding:18px 22px;background:#1D1E25"><div style="font-size:26px;font-weight:900;color:#B8B8C4">${esc(i.name)}</div><div style="font-size:38px;font-weight:900;color:${lite(d)}">${esc(i.pct)}</div></div>`; }).join('')}</div>
  <div style="position:absolute;bottom:150px;left:80px;font-size:40px;font-weight:700;color:#9A9AA6">밀어서 오늘의 시황 보기 →</div>`, 'dark');
page(2, head('KOREA NEWS', '📰 국내 주요 뉴스') + news(post.kr.news));
page(3, head('U.S. NEWS', '📰 미국 주요 뉴스') + news(post.us.news));
page(4, head('KOREA', '국내, 왜 움직였나') + why('kr', kp));
page(5, head('U.S.', '미국, 왜 움직였나') + why('us', nq));
page(6, head('MARKET', '📊 오늘의 숫자') + `<div class="grid">${post.items.map(tile).join('')}</div>`);
const E = { 금: '🥇', WTI유: '🛢️', 브렌트유: '🛢️' };
page(7, head('GOLD & OIL', '금·유가는 왜') + post.items.slice(5).map(i => { const d = dir(i.pct);
  return `<div class="cm bg-${d}"><div class="e">${E[i.name] || ''}</div><div class="n">${esc(i.name)}</div><div><div class="p ${d}">${esc(i.pct)}</div><div class="v">${esc(i.value)}</div></div></div>`; }).join('')
  + `<div class="say">${esc(post.commodity.story)}</div>`);

// ───────── 릴스 프레임 (9:16, 위·아래 UI 영역을 피해 가운데에 배치)
const R = (n, html, cls = 'dark') => shot(path.join(out, 'reel', `r${n}.png`), 1080, 1920, `<div style="height:1460px;display:flex;flex-direction:column;justify-content:center">${html}</div>`, cls, '200px 80px 260px');
R(1, `<div class="k">${esc(post.date)} · ${esc(post.label)}</div>
  <div style="font-size:112px;font-weight:900;line-height:1.24;margin:56px 0 70px">${esc(post.headline)}</div>
  ${[kp, nq].map(i => { const d = dir(i.pct); return `<div style="border-radius:34px;padding:34px 44px;background:#23242C;margin-bottom:26px;display:flex;justify-content:space-between;align-items:center"><div style="font-size:48px;font-weight:900;color:#B8B8C4">${esc(i.name)}</div><div style="font-size:112px;font-weight:900;color:${lite(d)}">${esc(i.pct)}</div></div>`; }).join('')}`);
R(2, `<div class="k" style="color:#8A8A92">MARKET</div><h2 style="font-size:76px;margin-bottom:40px;color:#1F1F24">오늘의 숫자</h2><div class="grid" style="gap:26px">${post.items.map(i => { const d = dir(i.pct);
  return `<div class="tile bg-${d}" style="height:300px;color:#1F1F24"><div class="n" style="font-size:40px">${esc(i.name)}</div><div class="p ${d}" style="font-size:80px">${esc(i.pct)}</div><div class="v" style="font-size:36px">${esc(i.value)}</div></div>`; }).join('')}</div>`, '');
R(3, [['kr', 'KOREA', kp], ['us', 'U.S.', nq]].map(([r, k, i]) => { const d = dir(i.pct);
  return `<div style="margin-bottom:70px"><div class="k" style="color:#9A9AA6">${k}</div><div style="font-size:84px;font-weight:900;line-height:1.24;margin:14px 0 20px">${esc(post[r].key)}</div><div style="font-size:70px;font-weight:900;color:${lite(d)}">${esc(i.name)} ${esc(i.pct)}</div></div>`; }).join(''));
R(4, `<div style="font-size:60px;font-weight:700;color:#9A9AA6">뉴스 링크 · 이유 · 금·유가까지</div>
  <div style="font-size:112px;font-weight:900;line-height:1.28;margin:34px 0 60px">자세한 시황은<br>프로필 최신 게시물에서</div>
  <div style="font-size:64px;font-weight:900;color:#FF6B6B">${esc(HANDLE)}</div>`);

// ───────── 캡션 (뉴스 링크 포함. 인스타 본문 URL 은 눌러서 열리지 않으므로 복사해 쓰는 용도)
const linkBlock = (t, a) => `${t}\n` + a.map(x => `${ARROW[x.s]} ${x.t}\n${x.u}`).join('\n');
const tick = post.items.map(i => `${i.name} ${i.pct}`).join(' / ');
const tags = '#시황 #주식 #코스피 #나스닥 #증시 #경제뉴스 #금값 #유가';
const cap = `${post.headline}\n\n${tick}\n\n${post.kr.story}\n\n${post.us.story}\n\n${post.commodity.story}\n\n` +
  `${linkBlock('[국내 뉴스]', post.kr.news)}\n\n${linkBlock('[미국 뉴스]', post.us.news)}\n\n` +
  `※ 참고용 정보이며 투자 권유가 아닙니다.\n\n${tags}\n`;
if (cap.length > 2150) { console.error(`캡션이 너무 김(${cap.length}자, 한도 2200): 문장·URL 을 줄이세요`); process.exit(1); }
fs.writeFileSync(path.join(out, 'caption.txt'), cap);
fs.writeFileSync(path.join(out, 'reel-caption.txt'), `${post.headline}\n\n${kp.name} ${kp.pct} / ${nq.name} ${nq.pct}\n\n뉴스 링크와 자세한 시황은 ${HANDLE} 프로필의 최신 게시물에서 확인하세요.\n\n${tags}\n`);
console.log(`OK out/01~07.png, out/reel/r1~r4.png, 캡션 ${cap.length}자`);
