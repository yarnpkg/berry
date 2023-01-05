const {NativeZipFS} = require(`./NativeZipFS`);
const {WasmZipFS} = require(`./WasmZipFS`);

const ZipFSImplementation = process.env.YARN_EXPERIMENT_NATIVE_ZIPFS === `1`
  ? NativeZipFS
  : WasmZipFS;

exports.ZipFS = class ZipFS extends ZipFSImplementation {};
