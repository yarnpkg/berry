const path = require(`path`);
const babel = require(`@babel/core`);
const os = require(`os`);
const root = path.dirname(__dirname);

// The cache in @babel/register never clears itself and will therefore grow
// forever causing massive slowdowns if left unchecked for a while
// this ensures a new cache key is generated every week
const weeksSinceUNIXEpoch = Math.floor(Date.now() / 604800000);

if (!process.env.BABEL_CACHE_PATH)
  process.env.BABEL_CACHE_PATH = path.join(os.tmpdir(), `babel`, `.babel.${babel.version}.${babel.getEnv()}.${weeksSinceUNIXEpoch}.json`);

require(`@babel/register`)({
  root,
  extensions: [`.tsx`, `.ts`],
  only: [
    p => `/`,
  ],
});
