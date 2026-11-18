// Local dev server with live reload. Listens on all interfaces so a phone on the same LAN can open it.
//   npm run dev   (PORT env var to change the port, default 5173)
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { buildHtml } from './build.mjs';
import { ROOT } from './lib/paths.mjs';

const PORT = Number(process.env.PORT) || 5173;
const clients = new Set();
let html = '';
let lastError = null;

const RELOAD = `<script>(()=>{const s=new EventSource('/__reload');s.onmessage=()=>location.reload();})();</script>`;

async function rebuild() {
  const t = Date.now();
  try {
    html = (await buildHtml({ dev: true })).replace('</body>', `${RELOAD}</body>`);
    lastError = null;
    console.log(`built in ${Date.now() - t} ms`);
  } catch (e) {
    lastError = e;
    console.error('build failed:', e.errors?.map((x) => `${x.location?.file}:${x.location?.line} ${x.text}`).join('\n') || e.message);
  }
  for (const c of clients) c.write('data: reload\n\n');
}

let timer;
for (const dir of ['src']) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 80); });
}
await rebuild();

http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': hi\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (lastError) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`Build error:\n${lastError.message}`);
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Local:   http://localhost:${PORT}/`);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) console.log(`  LAN:     http://${i.address}:${PORT}/   (mở trên điện thoại cùng Wi-Fi)`);
  }
  console.log('');
});
