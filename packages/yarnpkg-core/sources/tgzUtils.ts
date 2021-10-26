import {Filename, FakeFS, PortablePath, ZipCompression, ZipFS, NodeFS, ppath, xfs, npath, constants} from '@yarnpkg/fslib';
import {getLibzipPromise}                                                                            from '@yarnpkg/libzip';
import {PassThrough, Readable}                                                                       from 'stream';
import tar                                                                                           from 'tar';

import {WorkerPool}                                                                                  from './WorkerPool';
import * as miscUtils                                                                                from './miscUtils';
import {getContent as getZipWorkerSource, ConvertToZipPayload}                                       from './worker-zip';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS<PortablePath>;
  prefixPath?: PortablePath | null;
  compressionLevel?: ZipCompression;
  inMemory?: boolean;
}

export async function makeArchiveFromDirectory(source: PortablePath, {baseFs = new NodeFS(), prefixPath = PortablePath.root, compressionLevel, inMemory = false}: MakeArchiveFromDirectoryOptions = {}): Promise<ZipFS> {
  const libzip = await getLibzipPromise();

  let zipFs;
  if (inMemory) {
    zipFs = new ZipFS(null, {libzip, level: compressionLevel});
  } else {
    const tmpFolder = await xfs.mktempPromise();
    const tmpFile = ppath.join(tmpFolder, `archive.zip` as Filename);

    zipFs = new ZipFS(tmpFile, {create: true, libzip, level: compressionLevel});
  }

  const target = ppath.resolve(PortablePath.root, prefixPath!);
  await zipFs.copyPromise(target, source, {baseFs, stableTime: true, stableSort: true});

  return zipFs;
}

export interface ExtractBufferOptions {
  compressionLevel?: ZipCompression;
  prefixPath?: PortablePath;
  stripComponents?: number;
}

let workerPool: WorkerPool<ConvertToZipPayload, PortablePath> | null;

export async function convertToZip(tgz: Buffer, opts: ExtractBufferOptions) {
  const tmpFolder = await xfs.mktempPromise();
  const tmpFile = ppath.join(tmpFolder, `archive.zip` as Filename);

  workerPool ||= new WorkerPool(getZipWorkerSource());

  await workerPool.run({tmpFile, tgz, opts});

  return new ZipFS(tmpFile, {libzip: await getLibzipPromise(), level: opts.compressionLevel});
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

export async function extractArchiveTo<T extends FakeFS<PortablePath>>(tgz: Buffer, targetFs: T, {stripComponents = 0, prefixPath = PortablePath.dot}: ExtractBufferOptions = {}): Promise<T> {
  function ignore(entry: tar.ReadEntry) {
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

  for await (const entry of parseTar(tgz)) {
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
        targetFs.lutimesSync?.(mappedPath, constants.SAFE_TIME, constants.SAFE_TIME);
      } break;
    }
  }

  return targetFs;
}
