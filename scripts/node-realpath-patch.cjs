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
