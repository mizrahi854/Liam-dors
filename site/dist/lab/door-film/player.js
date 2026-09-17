// Scroll-scrubbed image sequence rendered by render.html.
// Frames load coarse → fine (every 8th, 4th, 2nd, all) so scrubbing works within a second.
const $ = s => document.querySelector(s);
const root = document.documentElement;
const section = $('#door-film'), sticky = $('.film-sticky'), canvas = $('.film-canvas'), ctx = canvas.getContext('2d');
const intro = $('[data-intro]'), caption = $('.film-caption'), progressBar = $('.film-progress');
const calloutSvg = $('.film-callout'), calloutLine = calloutSvg.querySelector('line'), calloutDot = calloutSvg.querySelector('circle'), calloutLabel = $('.film-callout-label');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t * t * (3 - 2 * t);
// Storyboard beat → layer being presented (order in door-model.js LAYERS).
const PRESENTED = {7: 0, 8: 2, 9: 3, 10: 4, 11: 5};
const LAYER_LABELS = ['חיפוי חוץ · גרניט פורצלן', 'פח חיזוק', 'ליבת בידוד תרמית ואקוסטית', 'חיזוקים פנימיים', 'פרופילי אלומיניום', 'חיפוי פנים'];

const setName = () => innerWidth / innerHeight < 1 ? 'portrait' : 'landscape';
let set = setName(), manifest, images = [], target = 0, current = 0, running = false, last = 0, lastBeat = -1, drawn = -1;

async function load(name) {
  manifest = await fetch(`../../media/door-film/${name}/manifest.json`).then(r => r.json());
  images = new Array(manifest.frames);
  resize();
  $('.film-poster').src = `../../media/door-film/${name}/0000.webp`;
  const transcript = $('.film-transcript');
  transcript.innerHTML = manifest.beats.map(b => `<li><b>${String(b.id).padStart(2, '0')} · ${b.title}</b>${b.sub}</li>`).join('');
  const url = i => `../../media/door-film/${name}/${String(i).padStart(4, '0')}.webp`;
  const queue = [];
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < manifest.frames; i += step) if (!queue.includes(i)) queue.push(i);
  let loaded = 0;
  const worker = async () => {
    while (queue.length) {
      const i = queue.shift(), img = new Image();
      img.decoding = 'async'; img.src = url(i);
      try { await img.decode(); images[i] = img; } catch {}
      loaded++;
      if (loaded === 1 || loaded % 24 === 0) { root.classList.add('is-ready'); draw(true); }
      $('.film-status').textContent = loaded < manifest.frames ? `טוען ${Math.round(loaded / manifest.frames * 100)}%` : '';
    }
  };
  await Promise.all(Array.from({length: 6}, worker));
  draw(true);
}

function nearest(i) {
  for (let d = 0; d < manifest.frames; d++) {
    if (images[i - d]) return images[i - d];
    if (images[i + d]) return images[i + d];
  }
}
function resize() {
  if (!manifest) return;
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(sticky.clientWidth * dpr); canvas.height = Math.round(sticky.clientHeight * dpr);
  calloutSvg.setAttribute('viewBox', `0 0 ${sticky.clientWidth} ${sticky.clientHeight}`);
  if (manifest && setName() !== set) { set = setName(); load(set); }
  draw(true);
}
// object-fit: cover mapping, shared by the image and the callout anchors
function cover() {
  const W = sticky.clientWidth, H = sticky.clientHeight, s = Math.max(W / manifest.width, H / manifest.height);
  return {s, x: (W - manifest.width * s) / 2, y: (H - manifest.height * s) / 2};
}

function draw(force = false) {
  if (!manifest) return;
  const t = current, index = Math.round(t * (manifest.frames - 1));
  const img = nearest(index);
  if (img && (force || index !== drawn)) {
    const {s, x, y} = cover(), dpr = canvas.width / sticky.clientWidth;
    ctx.drawImage(img, x * dpr, y * dpr, manifest.width * s * dpr, manifest.height * s * dpr);
    drawn = index;
  }

  intro.style.setProperty('--o', (1 - ease(clamp(t / .045))).toFixed(3));
  intro.style.visibility = t > .05 ? 'hidden' : 'visible';

  // Caption: the nearest storyboard beat, faded near the midpoints between beats.
  const beats = manifest.beats;
  let bi = 0; while (bi < beats.length - 1 && t > (beats[bi].t + beats[bi + 1].t) / 2) bi++;
  const b = beats[bi], prev = beats[bi - 1]?.t ?? -1, next = beats[bi + 1]?.t ?? 2;
  const start = (prev + b.t) / 2, end = (b.t + next) / 2, edge = Math.min(.018, (end - start) * .25);
  const captionO = bi === 0 ? 0 : Math.min(ease(clamp((t - start) / edge)), ease(clamp((end - t) / edge)), 1);
  if (bi !== lastBeat) {
    lastBeat = bi;
    $('.caption-index').textContent = String(b.id).padStart(2, '0');
    $('.caption-title').textContent = b.title;
    $('.caption-sub').textContent = b.sub;
  }
  caption.style.setProperty('--o', (bi === beats.length - 1 ? ease(clamp((t - start) / edge)) : captionO).toFixed(3));
  progressBar.style.setProperty('--p', t.toFixed(4));

  // Callout on the layer being presented.
  const layer = PRESENTED[b.id], anchor = layer != null && manifest.anchors[index]?.[layer];
  const o = layer != null ? captionO : 0;
  calloutSvg.style.opacity = calloutLabel.style.opacity = o;
  if (anchor && o > 0) {
    const {s, x, y} = cover();
    const ax = x + anchor[0] * manifest.width * s, ay = y + anchor[1] * manifest.height * s;
    const narrow = innerWidth < 768, half = (narrow ? 13 : 15) * LAYER_LABELS[layer].length / 3.2 + 12;
    const lx = clamp(narrow ? ax : ax - 90, half + 16, sticky.clientWidth - half - 16), ly = Math.max(110, narrow ? ay - 150 : ay - 120);
    calloutDot.setAttribute('cx', ax); calloutDot.setAttribute('cy', ay);
    calloutLine.setAttribute('x1', ax); calloutLine.setAttribute('y1', ay); calloutLine.setAttribute('x2', lx); calloutLine.setAttribute('y2', ly + 6);
    calloutLabel.textContent = LAYER_LABELS[layer];
    calloutLabel.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -100%)`;
  }
}

function measure() {
  const r = section.getBoundingClientRect();
  target = clamp(-r.top / Math.max(1, r.height - innerHeight));
}
function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  current += (target - current) * (1 - Math.exp(-dt * 9));   // light damping: follows the finger, hides wheel steps
  if (Math.abs(target - current) < 1e-4) current = target;
  draw();
  if (current !== target) requestAnimationFrame(tick); else running = false;
}
function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }

function setStatic(on) {
  root.classList.toggle('is-static', on);
  if (!on) { measure(); current = target; resize(); }
}

// QA: jump to a point of the film.
window.__film = {seek(t) { const r = section.getBoundingClientRect(); scrollTo({top: scrollY + r.top + clamp(t) * (r.height - innerHeight), behavior: 'instant'}); measure(); current = target; draw(true); }};

setStatic(reduced.matches);
reduced.addEventListener('change', () => setStatic(reduced.matches));
new ResizeObserver(() => { if (!root.classList.contains('is-static')) resize(); }).observe(sticky);
addEventListener('scroll', () => { if (!root.classList.contains('is-static')) { measure(); kick(); } }, {passive: true});
load(set).catch(() => { $('.film-status').textContent = 'הפריימים לא נמצאו — יש לרנדר קודם (render.html)'; });
