const tsNode = process.env.SETUP_TS_EXECUTION_WITH_TS_NODE === 'true' ? true :
process.env.SETUP_TS_EXECUTION_WITH_TS_NODE === 'false' ? false
// ts-node used by default
: true;

const path = require(`path`);
const os = require(`os`);
const root = path.dirname(__dirname);

if (tsNode) {
  if (!process.env.TS_CACHED_TRANSPILE_CACHE) {
    process.env.TS_CACHED_TRANSPILE_CACHE = path.resolve(__dirname, '../.typescript-cached-transpile');
    // Optional: portable cache, so it will not become invalid if you move your git clone
    process.env.TS_CACHED_TRANSPILE_PORTABLE = 'true';
  }
} else {
  const babel = require(`@babel/core`);
  // The cache in @babel/register never clears itself and will therefore grow
  // forever causing massive slowdowns if left unchecked for a while
  // this ensures a new cache key is generated every week
  const weeksSinceUNIXEpoch = Math.floor(Date.now() / 604800000);

  if (!process.env.BABEL_CACHE_PATH)
    process.env.BABEL_CACHE_PATH = path.join(os.tmpdir(), `babel`, `.babel.${babel.version}.${babel.getEnv()}.${weeksSinceUNIXEpoch}.json`);
}

if (tsNode) {
  // Configuration declared in tsconfig.json
  require('ts-node').register({
    projectSearchDir: path.resolve(__dirname, '../')
  });
} else {
  require(`@babel/register`)({
    root,
    extensions: [`.tsx`, `.ts`],
    only: [
      p => `/`,
    ],
  });
}
