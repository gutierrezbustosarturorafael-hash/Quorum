const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
const zlib = require('zlib');

const buildDirectory = path.resolve(__dirname, '..', 'build');
const gzip = promisify(zlib.gzip);
const compressibleExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml']);

const walk = async directory => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : entryPath;
  }));
  return files.flat();
};

const compressBuild = async () => {
  const files = await walk(buildDirectory);
  let originalBytes = 0;
  let compressedBytes = 0;
  let compressedCount = 0;
  for (const file of files) {
    if (!compressibleExtensions.has(path.extname(file).toLowerCase())) continue;
    const contents = await fs.readFile(file);
    const compressed = await gzip(contents);
    const compressedPath = `${file}.gz`;
    originalBytes += contents.length;
    if (compressed.length < contents.length) {
      await fs.writeFile(compressedPath, compressed);
      compressedBytes += compressed.length;
      compressedCount += 1;
    } else {
      await fs.rm(compressedPath, { force: true });
      compressedBytes += contents.length;
    }
  }
  const savedBytes = originalBytes - compressedBytes;
  const savedPercent = originalBytes
    ? Math.round((savedBytes / originalBytes) * 100)
    : 0;
  console.log(`Pre-compressed ${compressedCount} frontend assets; transfer size reduced by ${savedPercent}%.`);
};

compressBuild().catch(error => {
  console.error('Could not create pre-compressed frontend assets:', error);
  process.exitCode = 1;
});
