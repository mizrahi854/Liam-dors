import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../dist');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');
const data=JSON.parse(readFileSync(resolve(root,'catalog.json'),'utf8'));
assert.equal(data.photos.length,41);
assert.equal(new Set(data.photos.map(x=>x.id)).size,41);
assert.equal(data.featuredOrder.length,16);
assert.equal(new Set(data.featuredOrder).size,16);
for(const p of data.photos)for(const w of [480,960,1440])assert(existsSync(resolve(root,`media/photos/${String(p.id).padStart(2,'0')}-${w}.webp`)));
for(const [,url] of html.matchAll(/(?:src|href|poster|data-src)="([^"#]+)"/g)){
  if(/^(https?:|tel:|mailto:)/.test(url))continue;
  assert(existsSync(resolve(root,url.split("?")[0])),`Missing asset: ${url}`);
}
for(const [,url] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))assert(existsSync(resolve(root,url.split("?")[0])),`Missing CSS asset: ${url}`);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate IDs');
assert(html.lastIndexOf('id="craftsmanship"')>html.indexOf('class="section final-selection"'),'Craft must be last');
const expected=resolve(root,'../../docs/תוכן-לקוח.md');
if(existsSync(expected)){
  const body=readFileSync(expected,'utf8').split('\n\n').filter(p=>p.trim()&&!p.startsWith('#'));
  const normalized=html.replace(/<[^>]*>/g,' ').replace(/[\s.–]/g,'');
  for(const p of body)assert(normalized.includes(p.replace(/[\s.–]/g,'')),`Missing client copy: ${p.slice(0,55)}`);
}
let bytes=0;function walk(path){for(const name of readdirSync(path)){const p=resolve(path,name);statSync(p).isDirectory()?walk(p):bytes+=statSync(p).size;}}walk(root);
console.log(`PASS: 41 photos, 16 featured, local assets, approved copy, unique IDs, craftsmanship last. Public output ${(bytes/1048576).toFixed(2)} MiB.`);
