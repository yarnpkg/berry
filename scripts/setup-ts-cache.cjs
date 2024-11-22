const crypto = require(`crypto`);
const esbuild = require(`esbuild`);
const fs = require(`fs`);
const path = require(`path`);
const v8 = require(`v8`);
const zlib = require(`zlib`);

// Needed by the worker spawned by esbuild
if (process.versions.pnp)
  // Unquoted because Yarn doesn't support it quoted yet
  // TODO: make Yarn support quoted PnP requires in NODE_OPTIONS
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ``} --require ${require.resolve(`pnpapi`)}`;

const resolveVirtual = process.versions.pnp
  ? require(`pnpapi`).resolveVirtual
  : undefined;

// esbuild only supports major.minor.patch, no pre-release (nightly) specifier is allowed
// so we reduce the version down to major.minor
const NODE_VERSION = process.versions.node.split(`.`, 2).join(`.`);

const cache = {
  version: `1\0${esbuild.version}\0${NODE_VERSION}`,
  files: new Map(),
  isDirty: false,
};

const cachePath = path.join(__dirname, `../node_modules/.cache/yarn/esbuild-transpile-cache.bin`);
try {
  const cacheData = v8.deserialize(zlib.brotliDecompressSync(fs.readFileSync(cachePath)));
  if (cacheData.version === cache.version) {
    cache.files = cacheData.files;
  }
} catch {}

function persistCache() {
  if (!cache.isDirty)
    return;

  cache.isDirty = false;

  const data = v8.serialize({
    version: cache.version,
    files: cache.files,
  });

  fs.mkdirSync(path.dirname(cachePath), {recursive: true});

  const tmpPath = cachePath + crypto.randomBytes(8).toString(`hex`);
  fs.writeFileSync(tmpPath, zlib.brotliCompressSync(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
    },
  }));

  try {
    fs.renameSync(tmpPath, cachePath);
  } catch {
    fs.unlinkSync(tmpPath);
  }
}

process.once(`exit`, persistCache);
process.nextTick(persistCache);

process.setSourceMapsEnabled?.(true);

function compileFile(sourceCode, filename) {
  filename = resolveVirtual?.(filename) ?? filename;

  const cacheEntry = cache.files.get(filename);
  if (cacheEntry?.source === sourceCode)
    return {code: cacheEntry.code, map: cacheEntry.map};

  const res = esbuild.transformSync(sourceCode, {
    target: `node${NODE_VERSION}`,
    loader: path.extname(filename).slice(1),
    sourcefile: filename,
    sourcemap: `both`,
    platform: `node`,
    format: `cjs`,
    supported: {
      'dynamic-import': false,
    },
  });

  cache.isDirty = true;
  cache.files.set(filename, {
    source: sourceCode,
    code: res.code,
    map: res.map,
  });

  return {code: res.code, map: res.map};
}

module.exports = {
  compileFile,
  version: cache.version,
};
