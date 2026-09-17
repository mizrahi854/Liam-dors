// Lab server: the normal static server plus a local-only save endpoint used by the
// offline renderer (lab/door-film/render.html) and the GLB exporter. Not used for publishing.
import {createServer} from 'node:http';
import {createReadStream, statSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, extname, sep, dirname} from 'node:path';
const project = resolve(import.meta.dirname, '../..');
const root = resolve(project, 'site/dist');
const port = Number(process.env.PORT || 8766);
// Only these project-relative folders can be written.
const writable = ['site/dist/media/door-film/', 'site/dist/media/3d/', 'design/renders/door-film/'];
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2','.glb':'model/gltf-binary'};

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'POST' && url.pathname === '/__lab/save') {
    const rel = url.searchParams.get('path') || '';
    if (!/^[a-z0-9/_.-]+$/i.test(rel) || rel.includes('..') || !writable.some(prefix => rel.startsWith(prefix))) {
      response.writeHead(403); return response.end('path not allowed');
    }
    const chunks = [];
    request.on('data', c => chunks.push(c));
    request.on('end', () => {
      const target = resolve(project, rel);
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, Buffer.concat(chunks));
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(JSON.stringify({path: rel, bytes: Buffer.concat(chunks).length}));
    });
    return;
  }
  if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405);return response.end();}
  let path;
  try {path = resolve(root, '.' + decodeURIComponent(url.pathname));} catch {response.writeHead(400);return response.end();}
  if (path !== root && !path.startsWith(root + sep)) {response.writeHead(403);return response.end();}
  try {
    if (statSync(path).isDirectory()) path = resolve(path, 'index.html');
    const size = statSync(path).size;
    const headers = {'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'};
    let start = 0, end = size - 1, status = 200;
    const range = request.headers.range && /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (range) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(status, headers);
    if (request.method === 'HEAD') return response.end();
    createReadStream(path, {start, end}).pipe(response);
  } catch {response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});response.end('Not found');}
}).listen(port, '127.0.0.1', () => console.log(`Lab: http://127.0.0.1:${port}/lab/door-film/`));
