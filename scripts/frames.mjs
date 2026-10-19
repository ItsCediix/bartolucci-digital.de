#!/usr/bin/env node
// Frame pipeline for the scroll-scrubbed demo video.
//
//   npm run frames -- <path-to-mp4> [--fps 12] [--width 540] [--quality 80] [--budget-mb 40] [--skip-video] [--skip-frames]
//
// Reads public/data/chapters.json, extracts one WebP frame sequence per chapter into
// public/frames/<chapter-id>/NNNN.webp, writes public/frames/manifest.json, the poster
// (public/video/poster.webp, frame at 0.0 s), a second poster from the hook
// (public/video/poster-hook.webp, 5.2 s), the mobile/fallback MP4
// (public/video/demo-720.mp4, 720x1280 H.264 CRF 24, keyframe every second) and the
// Open-Graph image (public/og.jpg, 1200x630 from the end card).
//
// Needs ffmpeg + ffprobe on PATH. The source MP4 is never modified.
// The script never deletes anything: a re-run overwrites files with the same name and
// the manifest only references the frames of the current run.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const TMP = path.join(ROOT, '.frames-tmp');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const src = args.find((a) => !a.startsWith('--') && /\.(mp4|mov|mkv|webm)$/i.test(a));
if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/frames.mjs <video.mp4> [--fps 12] [--width 540] [--quality 80] [--budget-mb 40]');
  process.exit(1);
}
let FPS = Number(opt('fps', 12));
let W = Number(opt('width', 540));
let Q = Number(opt('quality', 80));
const BUDGET = Number(opt('budget-mb', 40)) * 1024 * 1024;

const chaptersFile = path.join(PUB, 'data', 'chapters.json');
const chaptersDoc = JSON.parse(fs.readFileSync(chaptersFile, 'utf8'));
const chapters = chaptersDoc.chapters;

const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, {stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 << 20, ...opts});
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error(`${cmd} failed`);
  }
  return r.stdout;
};
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
const dirSize = (d) => (fs.existsSync(d) ? fs.readdirSync(d).reduce((s, f) => s + fs.statSync(path.join(d, f)).size, 0) : 0);

// ---------------------------------------------------------------- probe
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', src]));
const duration = Number(probe.format.duration);
const [fn, fd] = probe.streams[0].r_frame_rate.split('/').map(Number);
const srcFps = fn / fd;
console.log(`source: ${probe.streams[0].width}x${probe.streams[0].height} @ ${srcFps} fps, ${duration.toFixed(3)} s, ${probe.streams[0].nb_frames} frames`);
if (Math.abs(duration - chaptersDoc.video.duration) > 0.5) {
  console.warn(`WARNING: chapters.json says ${chaptersDoc.video.duration} s but the file is ${duration.toFixed(3)} s`);
}
const last = chapters[chapters.length - 1];
if (last.end > duration + 0.05) {
  console.warn(`WARNING: last chapter ends at ${last.end} s, file ends at ${duration.toFixed(3)} s -> clamped`);
  last.end = duration;
}

fs.mkdirSync(TMP, {recursive: true});
fs.mkdirSync(path.join(PUB, 'frames'), {recursive: true});
fs.mkdirSync(path.join(PUB, 'video'), {recursive: true});

// ---------------------------------------------------------------- frames
if (!flag('skip-frames')) {
  // 1) size projection on a 10 s sample window (chapter "website") so the final run happens exactly once
  const sampleDir = path.join(TMP, 'sample');
  const project = (fps, w, q) => {
    fs.mkdirSync(sampleDir, {recursive: true});
    run('ffmpeg', ['-v', 'error', '-y', '-ss', '12', '-t', '10', '-i', src, '-vf', `fps=${fps},scale=${w}:-2`, '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', path.join(sampleDir, `s_${fps}_${q}_%04d.webp`)]);
    const files = fs.readdirSync(sampleDir).filter((f) => f.startsWith(`s_${fps}_${q}_`));
    const bytes = files.reduce((s, f) => s + fs.statSync(path.join(sampleDir, f)).size, 0);
    const perFrame = bytes / files.length;
    const total = perFrame * Math.ceil(duration * fps);
    console.log(`projection ${fps} fps / q${q} / ${w}px: ${(perFrame / 1024).toFixed(1)} KB per frame -> ~${mb(total)} for the whole film`);
    return total;
  };
  let projected = project(FPS, W, Q);
  if (projected > BUDGET && !flag('no-auto')) {
    console.log(`projected size exceeds ${mb(BUDGET)} -> dropping to 10 fps / quality 74`);
    FPS = 10;
    Q = 74;
    projected = project(FPS, W, Q);
  }

  // 2) one pass over the whole film
  const allDir = path.join(TMP, `all_${FPS}_${Q}_${W}`);
  fs.mkdirSync(allDir, {recursive: true});
  console.log(`extracting all frames at ${FPS} fps, ${W}px wide, quality ${Q} ...`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `fps=${FPS},scale=${W}:-2`, '-c:v', 'libwebp', '-quality', String(Q), '-compression_level', '6', path.join(allDir, '%05d.webp')]);
  const all = fs.readdirSync(allDir).filter((f) => f.endsWith('.webp')).sort();
  console.log(`${all.length} frames extracted`);

  // 3) distribute into chapter folders (frame k = time k / FPS)
  const manifest = {fps: FPS, width: W, quality: Q, duration, generated: new Date().toISOString(), chapters: {}};
  let total = 0;
  for (const ch of chapters) {
    const dir = path.join(PUB, 'frames', ch.id);
    fs.mkdirSync(dir, {recursive: true});
    const isLast = ch === last;
    let n = 0;
    let firstTime = null;
    let lastTime = null;
    for (let k = 0; k < all.length; k++) {
      const t = k / FPS;
      if (t < ch.start - 1e-6) continue;
      if (!(t < ch.end - 1e-6 || (isLast && t <= ch.end + 1e-6))) continue;
      n++;
      const name = String(n).padStart(4, '0') + '.webp';
      fs.copyFileSync(path.join(allDir, all[k]), path.join(dir, name));
      if (firstTime === null) firstTime = t;
      lastTime = t;
    }
    const size = dirSize(dir);
    total += size;
    manifest.chapters[ch.id] = {count: n, start: ch.start, end: ch.end, firstTime, lastTime, bytes: size};
    console.log(`${ch.id.padEnd(16)} ${String(n).padStart(4)} frames  ${firstTime?.toFixed(3)} s – ${lastTime?.toFixed(3)} s  ${mb(size)}`);
  }
  manifest.totalBytes = total;
  fs.writeFileSync(path.join(PUB, 'frames', 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`frames total: ${mb(total)} (budget ${mb(BUDGET)})`);
}

// ---------------------------------------------------------------- posters + OG
const poster = (t, out, width) => run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-c:v', 'libwebp', '-quality', '86', out]);
poster(0.0, path.join(PUB, 'video', 'poster.webp'), 720);
poster(5.2, path.join(PUB, 'video', 'poster-hook.webp'), 720);
run('ffmpeg', ['-v', 'error', '-y', '-ss', '91.5', '-i', src, '-frames:v', '1', '-vf', 'crop=1080:567:0:800,scale=1200:630', '-q:v', '3', path.join(PUB, 'og.jpg')]);
console.log('poster.webp, poster-hook.webp, og.jpg written');

// ---------------------------------------------------------------- mobile / fallback video
if (!flag('skip-video')) {
  const out = path.join(PUB, 'video', 'demo-720.mp4');
  console.log('encoding demo-720.mp4 ...');
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'scale=720:1280', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', out]);
  console.log(`demo-720.mp4: ${mb(fs.statSync(out).size)}`);
}
console.log('done');
