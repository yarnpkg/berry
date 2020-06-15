const path = require(`path`);
const babel = require(`@babel/core`);
const os = require(`os`);
const root = path.dirname(__dirname);

if (!process.env.BABEL_CACHE_PATH)
  process.env.BABEL_CACHE_PATH = path.join(os.tmpdir(), `babel`, `.babel.${babel.version}.${babel.getEnv()}.json`);

require(`@babel/register`)({
  root,
  extensions: [`.tsx`, `.ts`],
  only: [
    p => `/`,
  ],
});
