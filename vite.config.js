import { defineConfig } from 'vite';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

function serveRootDir(dir) {
  return {
    name: 'serve-root-' + dir,
    configureServer(server) {
      server.middlewares.use('/' + dir + '/', (req, res, next) => {
        const file = join(process.cwd(), dir, decodeURIComponent(req.url.slice(1)));
        if (existsSync(file) && statSync(file).isFile()) {
          const mime = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }[extname(file).toLowerCase()];
          if (mime) res.setHeader('Content-Type', mime);
          createReadStream(file).pipe(res);
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  // Wichtig für GitHub Pages: base-path so dass es unter pmh-beta.github.io/english-stars/ funktioniert
  base: './',
  build: {
    // Output direkt nach docs/ damit GitHub Pages das einfach servieren kann
    outDir: 'dist',
    emptyOutDir: true,
    // Damit MP3 + Icon-Pfade einfach bleiben
    assetsDir: 'assets'
  },
  server: {
    port: 5173,
    open: true
  },
  plugins: [serveRootDir('music')]
});
