// Hijack fs.promises.realpath to fall back to sync realpath on ENOENT.
// Without this, Prisma's generator in some environments (Windows + npm symlinks,
// or certain Docker bind mounts) fails to resolve its own installation path
// with: "ENOENT: no such file or directory, realpath .../node_modules/@prisma/client"
const fs = require('fs');

const originalRealpath = fs.promises.realpath;

fs.promises.realpath = async function realpathWithSyncFallback(path, options) {
  try {
    return await originalRealpath.call(this, path, options);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fs.realpathSync(path);
    }
    throw error;
  }
};
