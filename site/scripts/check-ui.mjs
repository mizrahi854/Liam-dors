import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../dist');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const js=readFileSync(resolve(root,'app.js'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');
assert(!/[←→↗↓▶Ⅱ×]/u.test(html+js),'Use vector icons instead of text symbols');
assert.equal((html.match(/class="hero-slide(?: is-active)?"/g)||[]).length,3);
const order=[...html.matchAll(/src="media\/hero-(gray|brown|garden)-960.webp"/g)].map(x=>x[1]);
assert.deepEqual(order,['gray','brown','garden']);
assert(js.includes('}, 3000)'),'Three-second rotation');
assert(js.includes('clearTimeout(slideTimer)') && js.includes('document.hidden') && js.includes('heroFocused'));
for(const tag of html.matchAll(/<video\b[^>]*class="ambient-video"[^>]*>/g))for(const flag of ['autoplay','muted','playsinline','loop','aria-describedby'])assert(tag[0].includes(flag),`Missing video ${flag}`);
assert(css.includes('@media(min-width:700px)')&&css.includes('@media(min-width:1100px)'));
assert(html.includes('accessibility.html')&&html.includes('data-open-accessibility'));
assert(existsSync(resolve(root,'accessibility.html')));
for(const name of ['index.html','accessibility.html']){
 const text=readFileSync(resolve(root,name),'utf8');
 assert(/<html[^>]*lang="he"/.test(text));assert(/<html[^>]*dir="rtl"/.test(text));
 for(const [,url] of text.matchAll(/(?:src|href|poster|data-src)="([^"#]+)"/g)){
  if(/^(https?:|tel:|mailto:)/.test(url))continue;
  assert(existsSync(resolve(root,url.split("?")[0])),`${name}: missing ${url}`);
 }
}
const values=['contrast','links','font','headings','cursor','motion'];
const prefs=readFileSync(resolve(root,'preferences.js'),'utf8');
const styles=readFileSync(resolve(root,'accessibility.css'),'utf8');
for(const pref of values){assert(prefs.includes(pref));assert(styles.includes(`a11y-${pref}`));}
console.log('PASS: hero order, timer guardrails, SVG icons, video attributes, responsive rules, accessibility assets. Static checks only; browser and assistive-technology verification remains pending.');
