const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const catalog = $('#catalog');
const galleryView = $('#gallery-view');
const header = $('#site-header');
const navigation = $('#navigation');
const lightbox = $('#lightbox');
const hero = $('#hero');
const motionReduced = () => reduceMotion.matches || document.documentElement.classList.contains('a11y-motion');
const iconPaths = {"left": "<path d=\"M20 12H4m6-6-6 6 6 6\"></path>", "right": "<path d=\"M4 12h16m-6-6 6 6-6 6\"></path>", "up-right": "<path d=\"M6 18 18 6M6 6h12v12\"></path>", "down": "<path d=\"M12 4v16m-6-6 6 6 6-6\"></path>", "play": "<path d=\"m8 5 11 7-11 7Z\"></path>", "pause": "<path d=\"M8 5v14M16 5v14\"></path>", "close": "<path d=\"m6 6 12 12M6 18 18 6\"></path>", "access": "<path d=\"M12 8v6m-7-5 7 2 7-2M8 21l4-7 4 7\"></path><circle cx=\"12\" cy=\"4\" r=\"2\"></circle>", "plus": "<path d=\"M12 5v14M5 12h14\"></path>"};
const icon = name => `<svg class="line-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name] || ""}</svg>`;
let photos = [], orderedPhotos = [], filter = 'all', activePhotos = [];
let galleryOpen = false, catalogScroll = 0, galleryScroll = 0;
let galleryOpener = null;
let returnFocus = null, scrollLocked = false, lockedY = 0;
let currentPhoto = null, animationFrame = 0;
const storage = {paused: new Set(), userStarted: new Set(), visible: new Map()};
const videos = $$('.ambient-video');
history.scrollRestoration = 'manual';
$('#year').textContent = new Date().getFullYear();

function photoSource(id, width = 960) { return `media/photos/${String(id).padStart(2, '0')}-${width}.webp`; }
function photoMarkup(photo, featured = false) {
  return `<button class="photo-card" data-open-photo="${photo.id}" aria-label="הגדלת התמונה: ${photo.title}"><figure><img src="${photoSource(photo.id, 480)}" srcset="${photoSource(photo.id, 480)} 480w, ${photoSource(photo.id, 960)} 960w, ${photoSource(photo.id, 1440)} 1440w" sizes="${featured ? '(max-width: 560px) calc(100vw - 48px), 512px' : '(max-width: 560px) calc(50vw - 30px), 250px'}" alt="${photo.title}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async"><figcaption><span>${photo.title}</span>${icon("up-right")}</figcaption></figure></button>`;
}
function renderGallery() {
  const shown = filter === 'all' ? orderedPhotos : orderedPhotos.filter(photo => photo.category === filter);
  $('#gallery-grid').innerHTML = shown.map(photo => photoMarkup(photo)).join('');
  $('#gallery-count').textContent = `${shown.length} תמונות`;
  $$('.filters button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  return shown;
}
function setGallery(open, y = 0) {
  if (!galleryOpen && open) catalogScroll = scrollLocked ? lockedY : scrollY;
  if (galleryOpen && !open) galleryScroll = scrollLocked ? lockedY : scrollY;
  galleryOpen = open;
  catalog.hidden = open;
  if (!open && galleryOpener?.isConnected) galleryOpener.focus({preventScroll:true});
  galleryView.hidden = !open;
  document.body.classList.toggle('gallery-mode', open);
  document.title = open ? 'כל הדלתות — LIAM' : 'LIAM — דלתות שהן חלק מהאדריכלות';
  if (open) {renderGallery(); pauseAll();}
  window.scrollTo({top: y, behavior: 'instant'});
  requestAnimationFrame(updateScroll); syncSlider();
}
function enterGallery() {
  galleryOpener = document.activeElement;
  if (lightbox.open) closePhoto(false);
  if (!galleryOpen) catalogScroll = scrollY;
  history.pushState({view: 'gallery', catalogScroll}, '', '#doors');
  setGallery(true, 0);
  $('#gallery-title').focus({preventScroll: true});
}
function leaveGallery() {
  if (history.state?.view === 'gallery') history.back();
  else {history.replaceState(null, '', location.pathname); setGallery(false, catalogScroll);}
}
function lockScroll() {
  if (scrollLocked) return;
  lockedY = scrollY;
  scrollLocked = true;
  Object.assign(document.body.style, {position: 'fixed', top: `-${lockedY}px`, width: '100%', overflow: 'hidden'});
  pauseAll(); syncSlider();
}
function unlockScroll() {
  if (!scrollLocked) return;
  const y = lockedY;
  Object.assign(document.body.style, {position: '', top: '', width: '', overflow: ''});
  scrollLocked = false;
  window.scrollTo({top: y, behavior: 'instant'});
  requestAnimationFrame(() => {updateScroll(); chooseVideo(); syncSlider();});
}
function showMenu() {
  returnFocus = document.activeElement;
  lockScroll(); navigation.showModal();
  $('#menu-toggle').setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  navigation.close();
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  unlockScroll(); returnFocus?.focus({preventScroll: true});
}
$('#menu-toggle').addEventListener('click', showMenu);
$('#close-menu').addEventListener('click', closeMenu);
navigation.addEventListener('cancel', event => {event.preventDefault(); closeMenu();});

function showPhoto(id, push = true) {
  const photo = photos.find(item => item.id === id);
  if (!photo) return;
  if (!lightbox.open) {
    returnFocus = document.activeElement;
    if (galleryOpen) galleryScroll = scrollY;
    activePhotos = galleryOpen ? (filter === 'all' ? orderedPhotos : orderedPhotos.filter(item => item.category === filter)) : orderedPhotos;
    if (!activePhotos.some(item => item.id === id)) activePhotos = orderedPhotos;
    if (push) history.pushState({view: 'photo', parent: galleryOpen ? 'gallery' : 'catalog', catalogScroll, galleryScroll: scrollY, filter}, '', `#photo-${id}`);
    lockScroll(); lightbox.showModal();
  } else if (push) {
    history.replaceState(history.state, '', `#photo-${id}`);
  }
  currentPhoto = photo.id;
  const index = activePhotos.findIndex(item => item.id === id);
  const image = $('#lightbox-image');
  image.alt = photo.title;
  image.src = photoSource(id, 1440);
  $('#lightbox-title').textContent = photo.title;
  $('#lightbox-title').setAttribute('aria-live', 'polite');
  $('#lightbox-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(activePhotos.length).padStart(2, '0')}`;
  for (const delta of [-1, 1]) {
    const neighbor = activePhotos[(index + delta + activePhotos.length) % activePhotos.length];
    if (neighbor) {const preload = new Image(); preload.src = photoSource(neighbor.id, 1440);}
  }
}
function closePhoto(useHistory = true) {
  if (useHistory && history.state?.view === 'photo') {history.back(); return;}
  lightbox.close(); currentPhoto = null; unlockScroll();
  returnFocus?.focus({preventScroll: true});
  if (useHistory) {history.replaceState({view:'gallery'}, '', '#doors'); setGallery(true, galleryScroll);}
}
function stepPhoto(delta) {
  const i = activePhotos.findIndex(item => item.id === currentPhoto);
  const next = activePhotos[(i + delta + activePhotos.length) % activePhotos.length];
  if (next) showPhoto(next.id);
}
$('#close-lightbox').addEventListener('click', () => closePhoto());
lightbox.addEventListener('cancel', event => {event.preventDefault(); closePhoto();});
$('#next-photo').addEventListener('click', () => stepPhoto(1));
$('#previous-photo').addEventListener('click', () => stepPhoto(-1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') {event.preventDefault(); stepPhoto(1);}
  if (event.key === 'ArrowRight') {event.preventDefault(); stepPhoto(-1);}
});
let touchStart = null;
const touchSurface = $('.lightbox-image-wrap');
touchSurface.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1 ? {x:event.touches[0].clientX, y:event.touches[0].clientY} : null;
}, {passive: true});
touchSurface.addEventListener('touchmove', event => {if (event.touches.length > 1) touchStart = null;}, {passive: true});
touchSurface.addEventListener('touchend', event => {
  if (!touchStart || event.touches.length) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepPhoto(dx > 0 ? 1 : -1);
  touchStart = null;
}, {passive: true});

document.addEventListener('click', event => {
  const photoButton = event.target.closest('[data-open-photo]');
  if (photoButton) {showPhoto(Number(photoButton.dataset.openPhoto)); return;}
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;
  const hash = anchor.getAttribute('href');
  if (navigation.open) closeMenu();
  if (hash === '#doors') {event.preventDefault(); enterGallery(); return;}
  if (hash === '#' || document.getElementById(hash.slice(1))) {
    event.preventDefault();
    if (galleryOpen) setGallery(false, catalogScroll);
    history.replaceState(null, '', hash === '#' ? location.pathname : hash);
    if (hash === '#') window.scrollTo({top:0, behavior: motionReduced() ? 'instant' : 'smooth'});
    else {const target = document.getElementById(hash.slice(1));target.scrollIntoView({behavior: motionReduced() ? 'instant' : 'smooth'});if(target.hasAttribute('tabindex')) target.focus({preventScroll:true});}
  }
});
$('#back-to-catalog').addEventListener('click', leaveGallery);
$('.filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter; renderGallery();
});
function route(initial = false) {
  const hash = location.hash;
  const match = hash.match(/^#photo-(\d+)$/);
  if (match) {
    if (!lightbox.open && history.state?.parent === 'gallery') setGallery(true, history.state.galleryScroll || 0);
    showPhoto(Number(match[1]), false); return;
  }
  if (lightbox.open) closePhoto(false);
  if (hash === '#doors') {
    if (history.state?.catalogScroll != null) catalogScroll = history.state.catalogScroll;
    setGallery(true, initial ? 0 : galleryScroll);
  } else {
    const wasGallery = galleryOpen;
    if (galleryOpen) setGallery(false, catalogScroll);
    if (initial && hash && document.getElementById(hash.slice(1))) document.getElementById(hash.slice(1)).scrollIntoView();
    else if (wasGallery) window.scrollTo({top:catalogScroll, behavior:'instant'});
  }
}
window.addEventListener('popstate', () => route());

// One gentle transition every three seconds; user interaction always wins.
const slides = $$('.hero-slide');
const slideButtons = $$('[data-slide]');
const slidePause = $('#slider-pause');
let slideIndex = 0, slideTimer = 0, slidesPaused = false, heroVisible = true;
let heroHovered = false, heroFocused = false;
function syncSlider() {
  clearTimeout(slideTimer);
  const stopped = slidesPaused || motionReduced();
  slidePause.innerHTML = icon(stopped ? 'play' : 'pause');
  slidePause.setAttribute('aria-label', motionReduced() ? 'התמונה הבאה — החלפה אוטומטית כבויה בהעדפות הנגישות' : stopped ? 'הפעלת החלפת התמונות' : 'עצירת החלפת התמונות');
  if (!stopped && !document.hidden && !scrollLocked && !galleryOpen && heroVisible && !heroHovered && !heroFocused) {
    slideTimer = setTimeout(() => {setSlide(slideIndex + 1);}, 3000);
  }
}
function setSlide(index, manual = false) {
  slideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => {
    const active = i === slideIndex;
    slide.classList.toggle('is-active', active);
    slide.inert = !active;
    slide.setAttribute('aria-hidden', String(!active));
    slideButtons[i].setAttribute('aria-current', String(active));
  });
  if (manual) {
    slidesPaused = true;
    $('#slide-status').textContent = slideButtons[slideIndex].getAttribute('aria-label');
  }
  syncSlider();
}
slideButtons.forEach(button => button.addEventListener('click', () => setSlide(Number(button.dataset.slide), true)));
slidePause.addEventListener('click', () => {
  if (motionReduced()) {setSlide(slideIndex + 1, true); return;}
  slidesPaused = !slidesPaused; syncSlider();
});
hero.addEventListener('focusin', () => {heroFocused = true; syncSlider();});
hero.addEventListener('focusout', () => {queueMicrotask(() => {heroFocused = hero.contains(document.activeElement); syncSlider();});});
hero.addEventListener('mouseenter', () => {if(matchMedia('(hover:hover)').matches){heroHovered = true; syncSlider();}});
hero.addEventListener('mouseleave', () => {heroHovered = false; syncSlider();});
hero.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();setSlide(slideIndex + (event.key === 'ArrowLeft' ? 1 : -1), true);
});
let heroTouch = null;
hero.addEventListener('touchstart', event => {heroTouch = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;}, {passive:true});
hero.addEventListener('touchmove', event => {if(event.touches.length > 1) heroTouch = null;}, {passive:true});
hero.addEventListener('touchend', event => {
  if (!heroTouch || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - heroTouch.x, dy = event.changedTouches[0].clientY - heroTouch.y;
  if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) setSlide(slideIndex + (dx>0 ? 1 : -1), true);
  heroTouch = null;
}, {passive:true});
new IntersectionObserver(entries => {heroVisible = entries[0].isIntersecting; syncSlider();}, {threshold:.1}).observe(hero);
document.addEventListener('visibilitychange', syncSlider);
function updateScroll() {
  animationFrame = 0;
  if(scrollLocked) return;
  header.classList.toggle('solid', galleryOpen || hero.getBoundingClientRect().bottom < 90);
}
function scheduleScroll() {if (!animationFrame) animationFrame = requestAnimationFrame(updateScroll);}
window.addEventListener('scroll', scheduleScroll, {passive:true});
window.addEventListener('resize', scheduleScroll, {passive:true});
reduceMotion.addEventListener('change', () => {syncSlider(); chooseVideo();});
syncSlider();

function pauseAll() {videos.forEach(video => video.pause());}
function ensureVideo(video) {
  if (!video.getAttribute('src')) {video.src = video.dataset.src; video.load();}
}
function playVideo(video, manual = false) {
  if (document.hidden || galleryOpen || scrollLocked) return;
  video.muted = true; video.defaultMuted = true;
  ensureVideo(video);
  videos.filter(other => other !== video).forEach(other => other.pause());
  if (manual) storage.userStarted.add(video.id);
  const promise = video.play();
  if (promise) promise.catch(() => syncVideoButton(video));
}
function syncVideoButton(video) {
  const button = $(`[data-video="${video.id}"]`);
  button.innerHTML = icon(video.paused ? 'play' : 'pause');
  button.setAttribute('aria-label', video.paused ? 'הפעלת הסרטון' : 'עצירת הסרטון');
  button.setAttribute('aria-pressed', String(!video.paused));
}
function chooseVideo() {
  if (document.hidden || galleryOpen || scrollLocked) {pauseAll(); return;}
  const eligible = videos.filter(video => (storage.visible.get(video.id) || 0) > .28 && !storage.paused.has(video.id) && (!motionReduced() || storage.userStarted.has(video.id)) && (!navigator.connection?.saveData || storage.userStarted.has(video.id)));
  const chosen = eligible.sort((a,b) => (storage.visible.get(b.id) || 0) - (storage.visible.get(a.id) || 0))[0];
  videos.forEach(video => {if(video !== chosen) video.pause();});
  if (chosen && chosen.paused) playVideo(chosen);
}
const filmObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {const video = $('video',entry.target);storage.visible.set(video.id,entry.intersectionRatio);});
  chooseVideo();
}, {threshold:[0,.15,.28,.4,.6,.8,1]});
videos.forEach(video => {
  filmObserver.observe(video.closest('.film'));
  video.muted = true;
  video.addEventListener('play', () => syncVideoButton(video));
  video.addEventListener('pause', () => syncVideoButton(video));
  video.addEventListener('error', () => {storage.paused.add(video.id);syncVideoButton(video);});
  video.addEventListener('timeupdate', () => {
    const film = video.closest('.film');
    $('.video-progress span',film).style.transform = `scaleX(${video.duration ? video.currentTime / video.duration : 0})`;
    const time = $('.film-time',film);
    if (time) time.textContent = `00:${String(Math.floor(video.currentTime)).padStart(2,'0')} / 00:${String(Math.round(video.duration || 14)).padStart(2,'0')}`;
  });
  $(`[data-video="${video.id}"]`).addEventListener('click', () => {
    if (video.paused) {storage.paused.delete(video.id);playVideo(video, true);}
    else {storage.paused.add(video.id);video.pause();}
  });
});
document.addEventListener('visibilitychange', chooseVideo);
// A real interaction can unlock inline playback in browsers that initially blocked it.
document.addEventListener('pointerup', event => {if (!event.target.closest('[data-video]')) chooseVideo();}, {passive:true});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {if(entry.isIntersecting) {entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}});
}, {threshold: .06, rootMargin:'0px 0px -24px 0px'});
$$('.reveal').forEach(element => revealObserver.observe(element));
document.documentElement.classList.add('js-ready');

try {
  const response = await fetch('catalog.json?v=988bb4142db2');
  if (!response.ok) throw new Error(`Catalog ${response.status}`);
  const data = await response.json();
  photos = data.photos;
  orderedPhotos = [...data.featuredOrder.map(id => photos.find(photo => photo.id === id)), ...photos.filter(photo => !data.featuredOrder.includes(photo.id))];
  $$('.photo-slot').forEach(slot => {
    const photo = photos.find(item => item.id === Number(slot.dataset.photo));
    if (photo && !slot.children.length) slot.innerHTML = photoMarkup(photo, !!slot.dataset.format);
  });
  renderGallery();
  
  route(true); updateScroll();
} catch (error) {
  console.error('Could not load the door catalog', error);
  $('#gallery-error').hidden = false;
   updateScroll();
  if (location.hash === '#doors') setGallery(true, 0);
}

const settings = $('#accessibility-panel');
let settingsFocus;
function showSettings() {
  if (navigation.open) closeMenu();
  settingsFocus = document.activeElement;
  lockScroll(); settings.showModal();
  $('#accessibility-trigger').setAttribute('aria-expanded', 'true');
}
function closeSettings() {
  settings.close(); if (!lightbox.open) unlockScroll(); settingsFocus?.focus({preventScroll:true});
  $('#accessibility-trigger').setAttribute('aria-expanded', 'false');
}
$$('[data-open-accessibility]').forEach(button => button.addEventListener('click', showSettings));
$('#close-accessibility').addEventListener('click', closeSettings);
settings.addEventListener('cancel', event => {event.preventDefault();closeSettings();});
document.addEventListener('keydown', event => {
  if(event.altKey && event.code === 'KeyA') {event.preventDefault(); settings.open ? closeSettings() : showSettings();}
});
function syncPrefs() {
  const preferences = window.liamPreferences.get();
  $$('[data-pref]').forEach(control => {
    if(control.type === 'checkbox') control.checked = !!preferences[control.dataset.pref];
    else control.value = String(preferences[control.dataset.pref]);
  });
  syncSlider(); chooseVideo();
}
$$('[data-pref]').forEach(control => control.addEventListener('change', () => {
  window.liamPreferences.set(control.dataset.pref, control.type === 'checkbox' ? control.checked : control.value);
  syncPrefs();
}));
$('#reset-accessibility').addEventListener('click', () => {window.liamPreferences.reset();syncPrefs();});
syncPrefs();
