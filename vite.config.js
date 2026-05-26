import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function customMapDevSavePlugin() {
  return {
    name: 'clearance-custom-map-dev-save',
    configureServer(server) {
      server.middlewares.use('/__custom-maps/save', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5_000_000) req.destroy(new Error('custom map payload too large'));
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const pack = payload.pack;
            if (!pack || !pack.id || !Array.isArray(pack.maps)) throw new Error('invalid custom map pack');
            const slug = String(payload.slug || pack.title || pack.id)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 72) || 'custom-map';
            const dir = path.resolve(process.cwd(), 'public', 'custom-maps', 'dev');
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${slug}.json`);
            fs.writeFileSync(file, JSON.stringify(Object.assign({}, pack, { source: 'dev' }), null, 2));
            const indexFile = path.join(dir, 'index.json');
            const names = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'index.json').sort();
            fs.writeFileSync(indexFile, JSON.stringify({ packs: names.map((name) => ({ url: `/custom-maps/dev/${name}` })) }, null, 2));
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, file: path.relative(process.cwd(), file) }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [customMapDevSavePlugin()],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    allowedHosts: [
      'execute-livestock-statewide-elegant.trycloudflare.com',
      // Any Cloudflare Quick Tunnel hostname (*.trycloudflare.com)
      '.trycloudflare.com',
    ],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
  // Large GLBs in public/assets/ are served as static files; Vite will not
  // try to import them through its module graph.
});
