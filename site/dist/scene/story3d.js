// LIAM — the door film in #system, scrubbed by scroll.
//
// The pictures are the client's own 3D film (assets/fraim / gemini_generated_video_A335E975.mov),
// decoded to 117 clean frames in media/door-scene. Only the stretch before the film burns its
// own captions in is used, so every label on screen is drawn here, in real Hebrew type, over
// the picture — not baked into it. The film runs forward to the exploded view, then reverses
// to close, which is why the frame track turns around at chapter five.
//
// Progressive enhancement: the copy, the poster and the links are in the document before this
// runs. If anything here fails the section stays a readable article with a photograph.
const stage = document.querySelector('#system .scene-stage');
if (stage) boot();

function boot() {
  const section = document.querySelector('#system');
  const canvas = stage.querySelector('.scene-canvas');
  const context = canvas.getContext('2d', {alpha: false});
  const loader = stage.querySelector('.scene-loader');
  const loaderBar = stage.querySelector('.scene-loader-bar span');
  const chapters = [...section.querySelectorAll('.scene-chapter')];
  const calloutLayer = stage.querySelector('.scene-callouts');
  const leaders = calloutLayer.querySelector('.scene-leaders');
  const progress = [...stage.querySelectorAll('.scene-progress span')];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 767px)');
  const still = () => reduced.matches || root.classList.contains('a11y-motion');

  const FRAMES = 117;
  const SOURCE = {width: 586, height: 716};
  const frameSrc = i => `media/door-scene/${String(i).padStart(4, '0')}.webp`;

  /* ── the track ──
     Where the film is at each point of the scroll. Forward to the exploded macro shot,
     then back down to the closed door, so the section ends where it began. */
  const TRACK = [[0, 0], [.16, 34], [.31, 58], [.50, 88], [.64, 116], [.84, 30], [1, 0]];

  /* ── callouts ──
     `at` is the anchor inside the picture, in 0..1 of the frame, read off the film at the two
     keyframes it is given; in between it is interpolated, so the line stays on the part as the
     camera pushes in. `side` is the edge of the stage the label parks against. */
  const CALLOUTS = [
    {he: 'חיפוי אבן טבעית', en: 'STONE FINISH', side: 'left', y: .63, from: .41, to: .72,
     at: [[88, .22, .60], [116, .17, .62]]},
    {he: 'בידוד תרמי ואקוסטי', en: 'HIGH-DENSITY INSULATION', side: 'left', y: .19, from: .43, to: .72,
     at: [[88, .47, .22], [116, .50, .20]], key: true},
    {he: 'שלדת אלומיניום מחוזקת', en: 'REINFORCED ALUMINIUM FRAME', side: 'right', y: .30, from: .45, to: .72,
     at: [[88, .56, .48], [116, .60, .48]], key: true},
    {he: 'מערכת נעילה רב־נקודתית', en: 'MULTI-POINT LOCKING SYSTEM', side: 'right', y: .47, from: .47, to: .72,
     at: [[88, .66, .42], [116, .74, .42]]}
  ];

  const times = chapters.map(el => Number(el.dataset.at));
  const marks = times.map((t, i) => i === 0 ? 0 : (times[i - 1] + t) / 2);

  const images = [];
  let ready = false, loading = false, callouts = [];
  let onScreen = false, frame = 0, dirty = true, drawn = -1;
  let target = 0, current = 0, lastChapter = -1;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // Piecewise-linear lookup along a list of [t, value] pairs.
  function along(pairs, t) {
    if (t <= pairs[0][0]) return pairs[0][1];
    const last = pairs[pairs.length - 1];
    if (t >= last[0]) return last[1];
    let i = 0; while (t > pairs[i + 1][0]) i++;
    const [t0, v0] = pairs[i], [t1, v1] = pairs[i + 1];
    return lerp(v0, v1, (t - t0) / (t1 - t0));
  }

  function scrollProgress() {
    const box = section.getBoundingClientRect();
    const travel = box.height - stage.offsetHeight;
    return travel <= 0 ? 0 : clamp(-box.top / travel);
  }

  function setChapter(t) {
    let index = 0;
    for (let i = 0; i < marks.length; i++) if (t >= marks[i]) index = i;
    if (index === lastChapter) return;
    lastChapter = index;
    chapters.forEach((el, i) => el.toggleAttribute('data-active', i === index));
    progress.forEach((el, i) => el.toggleAttribute('data-on', i <= index));
    section.dataset.chapter = String(index + 1);
  }

  function buildCallouts() {
    calloutLayer.querySelectorAll('.scene-callout').forEach(el => el.remove());
    leaders.innerHTML = '';
    return CALLOUTS.map(spec => {
      const wrap = document.createElement('div');
      wrap.className = 'scene-callout';
      wrap.dataset.side = spec.side;
      if (spec.key) wrap.dataset.key = '';
      wrap.style.setProperty('--y', String(spec.y));
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = '<p class="scene-callout-label"><span class="he"></span>'
        + '<span class="en" dir="ltr" lang="en"></span></p><i class="scene-callout-dot"></i>';
      wrap.querySelector('.he').textContent = spec.he;
      wrap.querySelector('.en').textContent = spec.en;
      calloutLayer.append(wrap);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      leaders.append(line);
      return {spec, wrap, line, label: wrap.querySelector('.scene-callout-label'), dot: wrap.querySelector('.scene-callout-dot')};
    });
  }

  function placeCallouts(t, index) {
    const host = stage.getBoundingClientRect();
    const plate = canvas.getBoundingClientRect();
    let any = false;
    for (const callout of callouts) {
      const {spec} = callout;
      // Fade in over the first slice of the band, out over the last.
      const span = spec.to - spec.from;
      const reveal = clamp(Math.min((t - spec.from) / (span * .18), (spec.to - t) / (span * .18)));
      const shown = reveal > .01 && getComputedStyle(callout.wrap).display !== 'none';
      callout.wrap.style.opacity = String(reveal);
      callout.line.style.opacity = String(reveal * .8);
      callout.wrap.style.visibility = shown ? 'visible' : 'hidden';
      callout.line.style.visibility = shown ? 'visible' : 'hidden';
      if (!shown) continue;
      any = true;
      const nx = along(spec.at.map(([f, x]) => [f, x]), index);
      const ny = along(spec.at.map(([f, , y]) => [f, y]), index);
      const x = plate.left - host.left + nx * plate.width;
      const y = plate.top - host.top + ny * plate.height;
      callout.dot.style.transform = `translate(${x}px, ${y}px)`;
      const box = callout.label.getBoundingClientRect();
      const x1 = spec.side === 'left' ? box.right - host.left : box.left - host.left;
      const y1 = box.bottom - host.top - 4;
      callout.line.setAttribute('x1', x1.toFixed(1));
      callout.line.setAttribute('y1', y1.toFixed(1));
      callout.line.setAttribute('x2', x.toFixed(1));
      callout.line.setAttribute('y2', y.toFixed(1));
    }
    calloutLayer.hidden = !any;
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(box.width * dpr), height = Math.round(box.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      drawn = -1;                                    // the surface was cleared
    }
    const host = stage.getBoundingClientRect();
    leaders.setAttribute('viewBox', `0 0 ${Math.round(host.width)} ${Math.round(host.height)}`);
    dirty = true;
  }

  function draw(index) {
    const image = images[Math.round(index)];
    if (!image?.complete || !image.naturalWidth) return;
    // The frame is portrait; cover the plate so the door never letterboxes inside it.
    const scale = Math.max(canvas.width / SOURCE.width, canvas.height / SOURCE.height);
    const w = SOURCE.width * scale, h = SOURCE.height * scale;
    context.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  function tick() {
    frame = 0;
    if (!ready) return;
    const delta = target - current;
    if (Math.abs(delta) > .0004) { current += delta * .14; dirty = true; }
    else if (current !== target) { current = target; dirty = true; }
    if (dirty) {
      dirty = false;
      const index = along(TRACK, current);
      const step = Math.round(index);
      if (step !== drawn) { draw(index); drawn = step; }
      placeCallouts(current, index);
      setChapter(current);
    }
    if (onScreen && Math.abs(target - current) > .0004) schedule();
  }
  function schedule() { frame ||= requestAnimationFrame(tick); }

  function onScroll() {
    target = scrollProgress();
    if (ready) schedule(); else setChapter(target);
  }

  function load() {
    if (loading || ready || still()) return;
    loading = true;
    stage.dataset.state = 'loading';
    section.dataset.scene = 'on';
    let done = 0;
    // Honest progress: the bar is the share of frames actually decoded.
    const all = Array.from({length: FRAMES}, (_, i) => new Promise(resolve => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = image.onerror = () => {
        loaderBar.style.transform = `scaleX(${++done / FRAMES})`;
        resolve();
      };
      image.src = frameSrc(i);
      images[i] = image;
    }));
    Promise.all(all).then(() => {
      if (!images[0].naturalWidth) throw new Error('frames failed to decode');
      ready = true;
      callouts = buildCallouts();
      stage.dataset.state = 'ready';
      requestAnimationFrame(() => {
        resize();
        current = target = scrollProgress();
        const index = along(TRACK, current);
        draw(index); drawn = Math.round(index);
        loader.addEventListener('transitionend', () => loader.remove(), {once: true});
        setTimeout(() => loader.remove(), 1600);
        new ResizeObserver(() => { resize(); schedule(); }).observe(stage);
        dirty = true; schedule();
      });
    }).catch(error => {
      console.warn('[liam] door film unavailable', error);
      stage.dataset.state = 'unavailable';
      delete section.dataset.scene;
    });
  }

  new IntersectionObserver(entries => {
    onScreen = entries.some(entry => entry.isIntersecting);
    if (onScreen) { dirty = true; schedule(); }
  }, {rootMargin: '150px 0px'}).observe(section);

  const near = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    near.disconnect();
    load();
  }, {rootMargin: '140% 0px'});
  near.observe(section);

  addEventListener('scroll', onScroll, {passive: true});
  small.addEventListener('change', () => { resize(); schedule(); });
  reduced.addEventListener('change', () => { if (still() && !ready) stage.dataset.state = 'unavailable'; });
  setChapter(0);
  onScroll();
}
