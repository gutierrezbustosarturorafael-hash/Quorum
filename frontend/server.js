const http = require('http');
const fs = require('fs');
const path = require('path');

const buildDirectory = path.resolve(__dirname, 'build');
const indexPath = path.join(buildDirectory, 'index.html');
const port = Number(process.env.PORT) || 3000;
const statFile = async filePath => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() ? stats : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
};
const acceptsGzip = value => String(value || '').split(',').some(encoding => {
  const [name, ...parameters] = encoding.trim().toLowerCase().split(';');
  if (name !== 'gzip') return false;
  const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
  return !quality || Number(quality.trim().slice(2)) > 0;
});
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Invalid URL');
    return;
  }

  try {
    const requestedPath = path.resolve(buildDirectory, `.${pathname}`);
    if (requestedPath !== buildDirectory && !requestedPath.startsWith(`${buildDirectory}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    let filePath = requestedPath;
    let fileStats = await statFile(filePath);
    if (!fileStats) {
      if (path.extname(pathname)) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      filePath = indexPath;
      fileStats = await statFile(filePath);
    }
    if (!fileStats) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const compressedPath = `${filePath}.gz`;
    const compressedStats = await statFile(compressedPath);
    const useCompressed = Boolean(compressedStats && acceptsGzip(request.headers['accept-encoding']));
    const servedPath = useCompressed ? compressedPath : filePath;
    const servedStats = useCompressed ? compressedStats : fileStats;
    const headers = {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Content-Length': servedStats.size,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (compressedStats) headers.Vary = 'Accept-Encoding';
    if (useCompressed) headers['Content-Encoding'] = 'gzip';
    if (filePath === indexPath) {
      headers['Cache-Control'] = 'no-cache';
    } else if (/\.[\da-f]{8,}\./i.test(path.basename(filePath))) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    response.writeHead(200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = fs.createReadStream(servedPath);
    stream.on('error', error => {
      console.error('Could not serve frontend asset:', error.message);
      if (response.headersSent) {
        response.destroy(error);
      } else {
        response.writeHead(500);
        response.end('Could not serve asset');
      }
    });
    stream.pipe(response);
  } catch (error) {
    console.error('Frontend request error:', error.message);
    if (response.headersSent) {
      response.destroy(error);
    } else {
      response.writeHead(500);
      response.end('Could not serve asset');
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Quorum frontend listening on port ${port}`);
});
