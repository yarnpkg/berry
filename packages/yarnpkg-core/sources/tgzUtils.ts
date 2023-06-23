import {FakeFS, PortablePath, NodeFS, ppath, xfs, npath, constants, statUtils} from '@yarnpkg/fslib';
import {ZipCompression, ZipFS}                                                 from '@yarnpkg/libzip';
import {PassThrough, Readable}                                                 from 'stream';
import tar                                                                     from 'tar';
import {gunzipSync}                                                            from 'zlib';

import {parseTarEntries}                                                       from './FastZip';
import {WorkerPool}                                                            from './WorkerPool';
import * as miscUtils                                                          from './miscUtils';
import {getContent as getZipWorkerSource, ConvertToZipPayload}                 from './worker-zip';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS<PortablePath>;
  prefixPath?: PortablePath | null;
  compressionLevel?: ZipCompression;
  inMemory?: boolean;
}

export async function makeArchiveFromDirectory(source: PortablePath, {baseFs = new NodeFS(), prefixPath = PortablePath.root, compressionLevel, inMemory = false}: MakeArchiveFromDirectoryOptions = {}): Promise<ZipFS> {
  let zipFs;
  if (inMemory) {
    zipFs = new ZipFS(null, {level: compressionLevel});
  } else {
    const tmpFolder = await xfs.mktempPromise();
    const tmpFile = ppath.join(tmpFolder, `archive.zip`);

    zipFs = new ZipFS(tmpFile, {create: true, level: compressionLevel});
  }

  const target = ppath.resolve(PortablePath.root, prefixPath!);
  await zipFs.copyPromise(target, source, {baseFs, stableTime: true, stableSort: true});

  return zipFs;
}

export interface ExtractBufferOptions {
  algorithm?: `3rdParty` | `CustomJs` | `Wasm`;
  compressionLevel?: ZipCompression;
  destination?: PortablePath;
  enableWorkerPool?: boolean;
  prefixPath?: PortablePath;
  stripComponents?: number;
}

let workerPool: WorkerPool<ConvertToZipPayload, PortablePath> | null;

const defaultEnableWorkers = process.env.CONVERT_TO_ZIP_WORKERS === `0`;
const defaultConvertAlgorithm = process.env.CONVERT_TO_ZIP_ALGORITHM ?? `3rdParty`;

const convertAlgorithms: Record<string, (tgz: Buffer, opts: ExtractBufferOptions) => Promise<ZipFS>> = {
  [`3rdParty`]: convertToZip3rdParty,
  [`CustomJs`]: convertToZipCustomJs,
  [`Wasm`]: convertToZipWasm,
};

export async function convertToZip(tgz: Buffer, opts: ExtractBufferOptions) {
  if (opts.enableWorkerPool ?? defaultEnableWorkers) {
    return convertToZipWorker(tgz, opts);
  } else {
    return convertToZipNoWorker(tgz, opts);
  }
}

export async function convertToZipWorker(tgz: Buffer, opts: ExtractBufferOptions) {
  const destination = opts.destination ?? ppath.join(await xfs.mktempPromise(), `archive.zip`);

  workerPool ||= new WorkerPool(getZipWorkerSource());

  await workerPool.run({tgz, opts: {...opts, destination}});

  return new ZipFS(destination, {level: opts.compressionLevel});
}

export async function convertToZipNoWorker(tgz: Buffer, opts: ExtractBufferOptions) {
  const algorithm = opts.algorithm ?? defaultConvertAlgorithm;

  return await convertAlgorithms[algorithm](tgz, opts);
}

export async function convertToZip3rdParty(tgz: Buffer, opts: ExtractBufferOptions) {
  const destination = opts.destination ?? ppath.join(await xfs.mktempPromise(), `archive.zip`);

  const zipFs = new ZipFS(destination, {create: true, level: opts.compressionLevel, stats: statUtils.makeDefaultStats()});

  // Buffers sent through Node are turned into regular Uint8Arrays
  const tgzBuffer = Buffer.from(tgz.buffer, tgz.byteOffset, tgz.byteLength);
  await extractArchiveTo(0, tgzBuffer, zipFs, opts);

  zipFs.saveAndClose();

  return new ZipFS(destination, {level: opts.compressionLevel});
}

export async function convertToZipCustomJs(tgz: Buffer, opts: ExtractBufferOptions) {
  const destination = opts.destination ?? ppath.join(await xfs.mktempPromise(), `archive.zip`);

  const zipFs = new ZipFS(destination, {create: true, level: opts.compressionLevel, stats: statUtils.makeDefaultStats()});

  // Buffers sent through Node are turned into regular Uint8Arrays
  const tgzBuffer = Buffer.from(tgz.buffer, tgz.byteOffset, tgz.byteLength);
  await extractArchiveTo(1, tgzBuffer, zipFs, opts);

  zipFs.saveAndClose();

  return new ZipFS(destination, {level: opts.compressionLevel});
}

export async function convertToZipWasm(tgz: Buffer, opts: ExtractBufferOptions) {
  const zip = new ZipFS({
    type: `tar`,
    buffer: gunzipSync(tgz),
    skipComponents: opts.stripComponents,
    prefixPath: opts.prefixPath,
  }, {
    level: opts.compressionLevel,
    stats: statUtils.makeDefaultStats(),
  });

  const destination = opts.destination ?? ppath.join(await xfs.mktempPromise(), `archive.zip`);
  xfs.writeFilePromise(destination, zip.getBufferAndClose());

  return new ZipFS(destination, {level: opts.compressionLevel});
}

async function * parseTar(tgz: Buffer) {
  // @ts-expect-error - Types are wrong about what this function returns
  const parser: tar.ParseStream = new tar.Parse();

  const passthrough = new PassThrough({objectMode: true, autoDestroy: true, emitClose: true});

  parser.on(`entry`, (entry: tar.ReadEntry) => {
    passthrough.write(entry);
  });

  parser.on(`error`, error => {
    passthrough.destroy(error);
  });

  parser.on(`close`, () => {
    if (!passthrough.destroyed) {
      passthrough.end();
    }
  });

  parser.end(tgz);

  for await (const entry of passthrough) {
    const it = entry as tar.ReadEntry;
    yield it;
    it.resume();
  }
}

export async function extractArchiveTo<T extends FakeFS<PortablePath>>(v: number, tgz: Buffer, targetFs: T, {stripComponents = 0, prefixPath = PortablePath.dot}: ExtractBufferOptions = {}): Promise<T> {
  function ignore(entry: {path: string}) {
    // Disallow absolute paths; might be malicious (ex: /etc/passwd)
    if (entry.path[0] === `/`)
      return true;

    const parts = entry.path.split(/\//g);

    // We also ignore paths that could lead to escaping outside the archive
    if (parts.some((part: string) => part === `..`))
      return true;

    if (parts.length <= stripComponents)
      return true;

    return false;
  }

  const entries = v === 0
    ? parseTar(tgz)
    : parseTarEntries(gunzipSync(tgz));

  for await (const entry of entries) {
    if (ignore(entry))
      continue;

    const parts = ppath.normalize(npath.toPortablePath(entry.path)).replace(/\/$/, ``).split(/\//g);
    if (parts.length <= stripComponents)
      continue;

    const slicePath = parts.slice(stripComponents).join(`/`) as PortablePath;
    const mappedPath = ppath.join(prefixPath, slicePath);

    let mode = 0o644;

    // If a single executable bit is set, normalize so that all are
    if (entry.type === `Directory` || ((entry.mode ?? 0) & 0o111) !== 0)
      mode |= 0o111;

    switch (entry.type) {
      case `Directory`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [constants.SAFE_TIME, constants.SAFE_TIME]});

        targetFs.mkdirSync(mappedPath, {mode});
        targetFs.utimesSync(mappedPath, constants.SAFE_TIME, constants.SAFE_TIME);
      } break;

      case `OldFile`:
      case `File`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [constants.SAFE_TIME, constants.SAFE_TIME]});

        targetFs.writeFileSync(mappedPath, await miscUtils.bufferStream(entry as unknown as Readable), {mode});
        targetFs.utimesSync(mappedPath, constants.SAFE_TIME, constants.SAFE_TIME);
      } break;

      case `SymbolicLink`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [constants.SAFE_TIME, constants.SAFE_TIME]});

        targetFs.symlinkSync((entry as any).linkpath, mappedPath);
        targetFs.lutimesSync(mappedPath, constants.SAFE_TIME, constants.SAFE_TIME);
      } break;
    }
  }

  return targetFs;
}
