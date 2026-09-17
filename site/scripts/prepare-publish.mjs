import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../dist');
const hash=name=>createHash('sha256').update(readFileSync(resolve(root,name))).digest('hex').slice(0,12);
const version=name=>`${name}?v=${hash(name)}`;
// Each changed font / stylesheet / script gets its own immutable cache identity.
for(const name of ['styles.css','accessibility.css','story.css']){
 const file=resolve(root,name);
 const text=readFileSync(file,'utf8').replace(/url\(['"]?([^)'"\s?]+)(?:\?v=[a-f0-9]+)?['"]?\)/g,(_,asset)=>`url('${version(asset)}')`);
 writeFileSync(file,text);
}
const app=resolve(root,'app.js');
writeFileSync(app,readFileSync(app,'utf8').replace(/fetch\('catalog\.json(?:\?v=[a-f0-9]+)?'\)/,`fetch('${version('catalog.json')}')`));
const assets=['styles.css','accessibility.css','story.css','scene/story3d.css','preferences.js','app.js','story.js','scene/story3d.js'];
for(const name of ['index.html','accessibility.html']){
 const file=resolve(root,name);let html=readFileSync(file,'utf8');
 for(const asset of assets){const escaped=asset.replaceAll('.','\\.');html=html.replace(new RegExp(`((?:href|src)=")${escaped}(?:\\?v=[a-f0-9]+)?("|&)`,'g'),`$1${version(asset)}$2`);}
 // Preload the actual local Hebrew fonts before any fallback can remain visible.
 if(!html.includes('as="font"')) html=html.replace('</head>',`<link rel="preload" href="${version('media/fonts/heebo-hebrew.woff2')}" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="${version('media/fonts/assistant-hebrew.woff2')}" as="font" type="font/woff2" crossorigin>\n</head>`);
 else html=html.replace(/href="(media\/fonts\/[^"?]+)(?:\?v=[a-f0-9]+)?"/g,(_,asset)=>`href="${version(asset)}"`);
 writeFileSync(file,html);
}
writeFileSync(resolve(root,'.nojekyll'),'');
console.log('Publication assets versioned; local fonts and vector icons included.');
const gateway=resolve(root,'../../index.html');
let entry=readFileSync(gateway,'utf8');
const destination=`site/dist/index.html?v=${hash('index.html')}`;
entry=entry.replace(/url=site\/dist\/index\.html(?:\?v=[a-f0-9]+)?/g,`url=${destination}`)
 .replace(/(<p><a href=")site\/dist\/index\.html(?:\?v=[a-f0-9]+)?/,`$1${destination}`)
 .replace(/location\.replace\("site\/dist\/index\.html(?:\?v=[a-f0-9]+)?"(?: \+ location\.hash)?\);/,`location.replace("${destination}" + location.hash);`);
writeFileSync(gateway,entry);
