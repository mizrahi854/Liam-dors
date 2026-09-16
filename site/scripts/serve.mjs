import {createServer} from 'node:http';
import {createReadStream, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
const root = resolve(import.meta.dirname, '../dist');
const port = Number(process.env.PORT || 8765);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2'};
createServer((request, response) => {
  if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405);return response.end();}
  let path;
  try {path = resolve(root, '.' + decodeURIComponent(new URL(request.url,'http://localhost').pathname));} catch {response.writeHead(400);return response.end();}
  if (path !== root && !path.startsWith(root + sep)) {response.writeHead(403);return response.end();}
  try {
    if (statSync(path).isDirectory()) path = resolve(path,'index.html');
    const size = statSync(path).size;
    const headers = {'Content-Type':mime[extname(path)] || 'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    let start = 0, end = size - 1, status = 200;
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!range) {response.writeHead(416,{'Content-Range':`bytes */${size}`});return response.end();}
      start = range[1] ? Number(range[1]) : Math.max(0,size-Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]),size-1) : size-1;
      if(start>end || start>=size){response.writeHead(416,{'Content-Range':`bytes */${size}`});return response.end();}
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = end-start+1;
    response.writeHead(status,headers);
    if(request.method === 'HEAD') return response.end();
    createReadStream(path,{start,end}).pipe(response);
  } catch {response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${port}`));
