// Offline frame renderer. Usage (lab server must be running: `npm run lab` in site/):
//   render.html?set=portrait&t=0.44&samples=8          → preview one moment
//   render.html?set=portrait&run=1                      → render + save the whole sequence
//   render.html?set=landscape&run=1&from=120&to=200     → partial re-render
// Saves: design/renders/door-film/<set>/NNNN.jpg (masters, full size)
//        site/dist/media/door-film/<set>/NNNN.webp (web frames) + manifest.json
import * as THREE from 'three';
import {createFilm, createAccumulator, BEATS} from './scene.js';

const SETS = {
  portrait:  {w: 1080, h: 1920, webW: 720,  webH: 1280},
  landscape: {w: 1920, h: 1080, webW: 1600, webH: 900}
};
const q = new URLSearchParams(location.search);
const setName = q.get('set') || 'portrait';
const cfg = SETS[setName];
const FRAMES = +(q.get('frames') || 360);           // 12 s at 30 fps
const samples = +(q.get('samples') || 40);
const log = document.querySelector('#log');
const canvas = document.querySelector('#c');

const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true});
renderer.setPixelRatio(1);
renderer.setSize(cfg.w, cfg.h, false);
const film = await createFilm(renderer, {source: q.get('source') || 'glb'});
const draw = createAccumulator(renderer, cfg.w, cfg.h);
const web = Object.assign(document.createElement('canvas'), {width: cfg.webW, height: cfg.webH});
const webCtx = web.getContext('2d');

const blob = (c, type, quality) => new Promise(r => c.toBlob(r, type, quality));
const save = (path, body) => fetch(`/__lab/save?path=${encodeURIComponent(path)}`, {method: 'POST', body}).then(r => { if (!r.ok) throw new Error(`save ${path}: ${r.status}`); });
const pad = n => String(n).padStart(4, '0');

window.__film = {film, draw, BEATS, renderer};

if (!q.has('run')) {
  const t = +(q.get('t') || 0);
  const started = performance.now();
  draw(film, t, {samples});
  log.textContent = `${setName} ${cfg.w}×${cfg.h} · t=${t} · ${samples} samples · ${Math.round(performance.now() - started)} ms`;
  // ?save=name keeps a full-size still in design/renders/door-film/preview/ for review.
  if (q.get('save')) await blob(canvas, 'image/jpeg', .92).then(b => save(`design/renders/door-film/preview/${q.get('save')}.jpg`, b));
  window.__rendered = true;
} else {
  const from = +(q.get('from') || 0), to = Math.min(FRAMES - 1, +(q.get('to') ?? FRAMES - 1));
  const manifest = {set: setName, frames: FRAMES, fps: 30, width: cfg.webW, height: cfg.webH, pattern: `${setName}/{i}.webp`, anchors: [], beats: BEATS};
  const started = performance.now();
  for (let i = from; i <= to; i++) {
    const t = i / (FRAMES - 1);
    draw(film, t, {samples});
    manifest.anchors[i] = film.anchors();
    webCtx.imageSmoothingQuality = 'high';
    webCtx.drawImage(canvas, 0, 0, cfg.webW, cfg.webH);
    await Promise.all([
      blob(canvas, 'image/jpeg', .94).then(b => save(`design/renders/door-film/${setName}/${pad(i)}.jpg`, b)),
      blob(web, 'image/webp', .8).then(b => save(`site/dist/media/door-film/${setName}/${pad(i)}.webp`, b))
    ]);
    const done = i - from + 1, each = (performance.now() - started) / done;
    log.textContent = `${setName} frame ${i}/${to} · ${Math.round(each)} ms/frame · ETA ${Math.round(each * (to - i) / 1000)} s`;
    await new Promise(r => setTimeout(r, 0));   // keeps running in a background tab
  }
  if (from === 0 && to === FRAMES - 1) {
    await save(`site/dist/media/door-film/${setName}/manifest.json`, JSON.stringify(manifest));
  }
  log.textContent += ' · done';
  window.__rendered = true;
}
