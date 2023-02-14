const esbuild = require(`esbuild-wasm`);
const fs = require(`fs`);
const crypto = require(`crypto`);
const v8 = require(`v8`);
const zlib = require(`zlib`);
const path = require(`path`);
const pirates = require(`pirates`);

/**
There is an issue on Windows with Node.js v14 (tested v14.19.2 and v14.21.2) where
```sh
node esbuild-wasm\bin\esbuild --service=0.17.5 --ping
```
uses up to 400% CPU and 3.62 GB RAM for a while when an ESM loader is enabled.

```console
$ time NODE_OPTIONS="--require ./.pnp.cjs --loader ./.pnp.loader.mjs" node -p "require('esbuild-wasm').transformSync('let foo = 0;')"
{
  warnings: [],
  code: 'let foo = 0;\n',
  map: '',
  mangleCache: undefined,
  legalComments: undefined
}

________________________________________________________
Executed in   54.99 secs      fish           external
usr time    0.00 micros    0.00 micros    0.00 micros
sys time    0.00 micros    0.00 micros    0.00 micros
```
Reported upstream in https://github.com/evanw/esbuild/issues/2888 and seems to boil down to https://github.com/nodejs/node/issues/36616.

To workaround this issue we remove the loader from the NODE_OPTIONS since it's not needed in this case.
*/
if (process.env.NODE_OPTIONS) {
  const esmLoaderExpression = /\s*--experimental-loader\s+\S*\.pnp\.loader\.mjs\s*/;
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS.replace(esmLoaderExpression, ` `);
}

// Needed by the worker spawned by esbuild
if (process.versions.pnp)
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ``} -r ${JSON.stringify(require.resolve(`pnpapi`))}`;

const resolveVirtual = process.versions.pnp ? require(`pnpapi`).resolveVirtual : undefined;

// esbuild only supports major.minor.patch, no pre-release (nightly) specifier is allowed
// so we reduce the version down to major.minor
const NODE_VERSION = process.versions.node.split(`.`, 2).join(`.`);

const cache = {
  version: `${esbuild.version}\0${NODE_VERSION}`,
  files: new Map(),
  isDirty: false,
};

const cachePath = path.join(__dirname, `../node_modules/.cache/yarn/esbuild-transpile-cache.bin`);
try {
  const cacheData = v8.deserialize(zlib.brotliDecompressSync(fs.readFileSync(cachePath)));
  if (cacheData.version === cache.version) {
    cache.files = cacheData.files;
  }
} catch { }

function persistCache() {
  if (!cache.isDirty)
    return;
  cache.isDirty = false;

  fs.mkdirSync(path.dirname(cachePath), {recursive: true});
  const tmpPath = cachePath + crypto.randomBytes(8).toString(`hex`);
  fs.writeFileSync(
    tmpPath,
    zlib.brotliCompressSync(
      v8.serialize({
        version: cache.version,
        files: cache.files,
      }),
      {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      },
    ),
  );
  fs.renameSync(tmpPath, cachePath);
}

process.once(`exit`, persistCache);
process.nextTick(persistCache);

process.setSourceMapsEnabled?.(true);

pirates.addHook(
  (sourceCode, filename) => {
    filename = resolveVirtual?.(filename) || filename;

    const cacheEntry = cache.files.get(filename);

    if (cacheEntry?.source === sourceCode)
      return cacheEntry.code;

    const res = esbuild.transformSync(sourceCode, {
      target: `node${NODE_VERSION}`,
      loader: path.extname(filename).slice(1),
      sourcefile: filename,
      sourcemap: `inline`,
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
    });

    return res.code;
  },
  {
    extensions: [`.tsx`, `.ts`, `.js`],
    matcher(p) {
      if (p?.endsWith(`.js`)) {
        const normalizedP = p.replace(/\\/g, `/`);
        return normalizedP.includes(`packages/yarnpkg-pnp/sources/node`) || normalizedP.endsWith(`packages/yarnpkg-pnp/sources/loader/node-options.js`);
      }

      return true;
    },
  },
);
