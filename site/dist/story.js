// Progressive enhancement: document content is available before GSAP or media loads.
const $ = (selector, scope=document) => scope.querySelector(selector);
const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
const root = document.documentElement;
const story = $('#system');
const hardware = $('#details');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const disabled = () => reduced.matches || root.classList.contains('a11y-motion');
let libraryPromise, triggers=[], resizeFrame=0, initialized=false, assetsLoaded=false;
const listeners = new AbortController();
const signal = listeners.signal;
const clamp = x => Math.max(0,Math.min(1,x));
const mix = (a,b,t) => a+(b-a)*t;
function script(src) {
 return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.head.append(el);});
}
function library() {
 return libraryPromise ||= script('vendor/gsap.min.js').then(()=>script('vendor/ScrollTrigger.min.js')).then(()=>{window.gsap.registerPlugin(window.ScrollTrigger);});
}
// One supplied contact sheet, drawn as individual frames only when near this section.
// The source stays untouched; crops exclude its numbers, captions and invented labels.
const sheet=new Image(), wood=new Image(), metal=new Image();
const canvas=$('.door-sequence'), context=canvas.getContext('2d',{alpha:false});
const frames=[
 [3,32,254,300],[267,32,252,300],[530,32,251,300],[793,32,251,300],[1057,32,252,300],
 [3,435,254,296],[268,435,250,296],[530,523,333,215],[875,435,204,296],[1092,435,216,296],
 [3,834,254,271],[268,834,242,271],[521,834,271,271],[805,834,238,271],[1058,834,250,271]
];
// Product-copy anchors, with the supplied 15 frames used in their narrative order.
const shots=[[0,0],[1,4],[1.35,5],[1.7,6],[2,7],[2.4,8],[2.7,9],[3,10],[3.25,11],[3.6,12],[3.85,13],[5.45,13],[6,14]];
const stateNames=['הדלת במישור הקיר','תנועת הפתיחה','מבנה הכנף · כ־85 מ״מ','גרניט פורצלן','HPL','אלומיניום','חזית אחת. קו אחד.'];
let lastState=-1,currentProgress=0;
function loadAssets() {
 if(assetsLoaded)return;assetsLoaded=true;
 $$('[data-motion-src]').forEach(image=>{image.src=image.dataset.motionSrc;image.decoding='async';});
 sheet.onload=()=>{story.dataset.frames='ready';renderDoor(currentProgress);};
 sheet.src='media/story/door-storyboard.png';
 wood.src='media/photos/39-960.webp';metal.src='media/photos/33-960.webp';
 wood.onload=metal.onload=()=>renderDoor(currentProgress);
}
function drawFrame(index,alpha=1){
 const [x,y,w,h]=frames[index];context.globalAlpha=alpha;
 context.fillStyle='#202122';context.fillRect(0,0,canvas.width,canvas.height);
 // The wider exploded drawing is contained so every construction layer remains visible.
 const scale=Math.min(canvas.width/w,canvas.height/h);
 const dw=w*scale,dh=h*scale;
 context.drawImage(sheet,x,y,w,h,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
 context.globalAlpha=1;
}
function finishSample(image,opacity){
 if(!image.complete||!image.naturalWidth||opacity<=0)return;
 context.save();context.globalAlpha=opacity*.8;
 const newScale=Math.min(canvas.width/238,canvas.height/271),oldScale=800/271;
 const ratio=newScale/oldScale,oldLeft=(640-238*oldScale)/2;
 context.setTransform(ratio,0,0,ratio,(canvas.width-238*newScale)/2-oldLeft*ratio,(canvas.height-271*newScale)/2);
 // Same leaf and handle stay registered while the illustrative finish changes.
 context.beginPath();context.moveTo(130,64);context.lineTo(422,0);context.lineTo(426,730);context.lineTo(130,724);context.closePath();context.clip();
 context.globalCompositeOperation='soft-light';
 const crop=image===wood?[.52,.27,.22,.38]:[.4,.26,.22,.42];
 context.drawImage(image,image.naturalWidth*crop[0],image.naturalHeight*crop[1],image.naturalWidth*crop[2],image.naturalHeight*crop[3],85,0,355,750);
 context.restore();
}
function renderDoor(progress){
 currentProgress=progress;
 const stage=$('.door-world');
 const height=Math.round(640*stage.clientHeight/Math.max(1,stage.clientWidth));
 if(canvas.height!==height)canvas.height=height;
 if(sheet.complete&&sheet.naturalWidth){
  let anchor=0;while(anchor<shots.length-2&&progress>shots[anchor+1][0])anchor++;
  const [start,first]=shots[anchor],[end,last]=shots[anchor+1];
  const position=mix(first,last,clamp((progress-start)/(end-start)));
  const a=Math.floor(position),b=Math.min(14,a+1),fraction=position-a;
  // Brief cross-dissolve near each next frame avoids a long double-door exposure.
  const blend=clamp((fraction-.55)/.45);
  context.fillStyle='#202122';context.fillRect(0,0,canvas.width,canvas.height);
  drawFrame(a);if(blend>0)drawFrame(b,blend);
  if(progress>=3.85&&progress<=5.45){
   finishSample(wood,clamp((progress-3.85)/.15)*clamp(5-progress));
   finishSample(metal,clamp(progress-4)*clamp((5.45-progress)/.45));
  }
  canvas.style.opacity='1';story.dataset.frame=String((blend>.5?b:a)+1);
 }
 const active=Math.min(6,Math.round(progress));
 if(active!==lastState){lastState=active;$('.product-state').textContent=stateNames[active];$('.product-meter').textContent=`0${active+1} / 07`;}
 story.dataset.progress=progress.toFixed(3);
}
const steps=$$('[data-product-step]');
let stops=[];
function measure(){stops=steps.map(el=>el.getBoundingClientRect().top+scrollY);}
function productProgress(){
 const marker=scrollY+innerHeight*(innerWidth<768 ? .50 : .28);
 let index=0;while(index<stops.length-2 && marker>stops[index+1])index++;
 return Math.min(6,index+clamp((marker-stops[index])/Math.max(1,stops[index+1]-stops[index])));
}
function setup() {
 if(initialized || disabled() || $('#catalog').hidden) return;
 initialized=true;root.classList.add('story-motion-active');measure();
 const ST=window.ScrollTrigger;
 triggers.push(ST.create({id:'liam-product',trigger:story,start:'top bottom',end:'bottom top',onUpdate:()=>renderDoor(productProgress()),onRefresh:()=>{measure();renderDoor(productProgress());}}));
 const detailSteps=$$('.detail-step'), images=$$('.detail-visual img');
 triggers.push(ST.create({id:'liam-details',trigger:hardware,start:'top bottom',end:'bottom top',onUpdate:()=>{
  const marker=innerHeight*.64;let index=0;
  detailSteps.forEach((step,i)=>{if(step.getBoundingClientRect().top<marker)index=i;});
  images.forEach((image,i)=>{image.style.opacity=i===index?'1':'0';image.style.transform=`scale(${i===index?1.025:1})`;});
 }}));
 renderDoor(productProgress());ST.refresh();
}
function cleanup(keepLayout=false) {
 triggers.forEach(trigger=>trigger.kill());triggers=[];initialized=false;
 if(keepLayout)return;
 root.classList.remove('story-motion-active');
 canvas.style.opacity='0';
 $$('.detail-visual img').forEach(image=>{image.style.removeProperty('transform');image.style.removeProperty('opacity');});
 // A real project photograph is the fallback; never hide the written explanation.
 lastState=-1;
}
async function activate() {
 loadAssets();
 if(disabled()){cleanup();return;}
 try {await library();setup();} catch {cleanup();root.classList.add('story-motion-unavailable');}
}
const proximity=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){activate();proximity.disconnect();}}, {rootMargin:'650px 0px'});
proximity.observe(story);
reduced.addEventListener('change',()=>{if(assetsLoaded)disabled()?cleanup():activate();},{signal});
let lastReduced=disabled();
const preferences=new MutationObserver(()=>{const next=disabled();if(next===lastReduced){if(initialized)requestAnimationFrame(()=>window.ScrollTrigger.refresh());return;}lastReduced=next;if(assetsLoaded)next?cleanup():activate();});
preferences.observe(root,{attributes:true,attributeFilter:['class']});
const routes=new MutationObserver(()=>{if($('#catalog').hidden)cleanup(true);else if(assetsLoaded)activate();});
routes.observe($('#catalog'),{attributes:true,attributeFilter:['hidden']});
window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(initialized)window.ScrollTrigger.refresh();});},{passive:true,signal});
window.addEventListener('pagehide',()=>{cleanup();},{signal});
window.addEventListener('pageshow',()=>{if(assetsLoaded)activate();},{signal});

// Spoken demonstrations load only after a deliberate click and use native controls.
const player=$('#explanation-player'), video=$('#explanation-video');
const demonstrations={
 materials:{src:'media/video/materials-demo.mp4',title:'הדגמה בשטח',description:'נציג ליאם מציג דלת בכניסה לבית, את החיפוי ואת אופן הפתיחה. הסרטון כולל הסבר קולי וכתוביות צרובות בעברית.'},
 pivot:{src:'media/video/pivot-demo.mp4',title:'הדגמת פתיחה',description:'נציג ליאם מדגים פתיחה וסגירה של דלת פיבוט גדולה בכניסה מחופה. הסרטון כולל הסבר קולי.'}
};
let opener, previousOverflow;
function closePlayer(){video.pause();video.controls=false;player.close();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});video.removeAttribute('src');video.load();document.dispatchEvent(new Event('liam-video-closed'));}
$$('[data-explanation]').forEach(button=>button.addEventListener('click',()=>{
 const film=demonstrations[button.dataset.explanation];if(!film)return;
 opener=button;previousOverflow=document.body.style.overflow;
 $$('.ambient-video').forEach(el=>el.pause());
 $('#explanation-title').textContent=film.title;$('#explanation-description').textContent=film.description;
 video.src=film.src;video.muted=false;player.showModal();document.body.style.overflow='hidden';
 video.play().catch(()=>{video.controls=true;});
}));
video.addEventListener('loadedmetadata',()=>{video.controls=true;});
$('#close-explanation').addEventListener('click',closePlayer);
player.addEventListener('cancel',event=>{event.preventDefault();closePlayer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();},{signal});
