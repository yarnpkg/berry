const pirates = require(`pirates`);
const {compileFile} = require(`./setup-ts-cache.js`);

pirates.addHook(
  (code, filename) => {
    return compileFile(code, filename).code;
  },
  {
    extensions: [`.tsx`, `.ts`, `.js`],
  },
);
