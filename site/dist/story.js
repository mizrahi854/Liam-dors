// Spoken demonstrations for the door system and hardware sections.
// The scroll story that used to live here is now scene/story3d.js, and the hardware section
// is plain layout, so nothing on this page needs GSAP any more.
const $ = (selector, scope=document) => scope.querySelector(selector);
const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
const listeners = new AbortController();
const signal = listeners.signal;

// Spoken demonstrations load only after a deliberate click and use native controls.
const player=$('#explanation-player'), video=$('#explanation-video');
const demonstrations={
 materials:{src:'media/video/materials-demo.mp4',title:'הדגמה בשטח',description:'נציג ליאם מציג דלת בכניסה לבית, את החיפוי ואת אופן הפתיחה. הסרטון כולל הסבר קולי וכתוביות צרובות בעברית.'},
 pivot:{src:'media/video/pivot-demo.mp4',title:'הדגמת פתיחה',description:'נציג ליאם מדגים פתיחה וסגירה של דלת פיבוט גדולה בכניסה מחופה. הסרטון כולל הסבר קולי.'}
};
const demonstrationKeys=['materials','pivot'];
let opener, previousOverflow, currentDemonstration=0;
function closePlayer(){video.pause();video.controls=false;player.close();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});video.removeAttribute('src');video.load();document.dispatchEvent(new Event('liam-video-closed'));}
function loadDemonstration(key, autoplay=true){
 const film=demonstrations[key];if(!film)return;
 currentDemonstration=demonstrationKeys.indexOf(key);
 $$('.ambient-video').forEach(el=>el.pause());
 $('#explanation-title').textContent=film.title;$('#explanation-description').textContent=film.description;
 $('#explanation-position').textContent=`${String(currentDemonstration+1).padStart(2,'0')} / ${String(demonstrationKeys.length).padStart(2,'0')}`;
 video.src=film.src;video.muted=false;
 if(autoplay)video.play().catch(()=>{video.controls=true;});
}
$$('[data-explanation]').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.explanation;if(!demonstrations[key])return;
 opener=button;previousOverflow=document.body.style.overflow;
 loadDemonstration(key,false);player.showModal();document.body.style.overflow='hidden';
 video.play().catch(()=>{video.controls=true;});
}));
function stepDemonstration(delta){loadDemonstration(demonstrationKeys[(currentDemonstration+delta+demonstrationKeys.length)%demonstrationKeys.length]);}
video.addEventListener('loadedmetadata',()=>{video.controls=true;});
$('#close-explanation').addEventListener('click',closePlayer);
$('#previous-explanation').addEventListener('click',()=>stepDemonstration(-1));
$('#next-explanation').addEventListener('click',()=>stepDemonstration(1));
player.addEventListener('cancel',event=>{event.preventDefault();closePlayer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();},{signal});
