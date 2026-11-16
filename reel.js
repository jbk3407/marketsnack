// out/reel/r1~r4.png -> out/reel.mp4 (약 14초, 무음 트랙 포함) + out/reel-cover.png
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static'), out = path.join(__dirname, 'out');
const sec = [3.5, 3.5, 4, 3.5];
const inputs = sec.flatMap((t, i) => ['-loop', '1', '-t', String(t), '-i', path.join(out, 'reel', `r${i + 1}.png`)]);
const total = sec.reduce((a, b) => a + b, 0);
execFileSync(ffmpeg, ['-y', ...inputs, '-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo',
  '-filter_complex', `[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,fps=30,format=yuv420p[v]`,
  '-map', '[v]', '-map', '4:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-shortest', '-movflags', '+faststart',
  path.join(out, 'reel.mp4')], { stdio: 'ignore' });
fs.copyFileSync(path.join(out, 'reel', 'r1.png'), path.join(out, 'reel-cover.png'));
console.log(`OK out/reel.mp4 (${total}s, ${(fs.statSync(path.join(out, 'reel.mp4')).size / 1e6).toFixed(1)}MB)`);
