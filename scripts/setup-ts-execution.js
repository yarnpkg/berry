switch (process.env.YARNPKG_TRANSPILER) {
  case `esbuild`:
    require(`./setup-ts-execution-esbuild.js`);
    break;
  default:
  case `babel`:
    require(`./setup-ts-execution-babel.js`);
    break;
}
