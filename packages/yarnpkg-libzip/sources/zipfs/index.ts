import {NativeZipFS} from './NativeZipFS';
import {WasmZipFS}   from './WasmZipFS';

export * from './NativeZipFS';
export * from './WasmZipFS';

export * from './common';

const ZipFSImplementation = process.env.YARN_EXPERIMENT_NATIVE_ZIPFS === `1`
  ? NativeZipFS
  : WasmZipFS;

export class ZipFS extends ZipFSImplementation {}
