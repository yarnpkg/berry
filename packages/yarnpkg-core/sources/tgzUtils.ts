import {Filename, FakeFS, PortablePath, ZipCompression, ZipFS, NodeFS, ppath, xfs, npath} from '@yarnpkg/fslib';
import {getLibzipPromise}                                                                 from '@yarnpkg/libzip';
import tar                                                                                from 'tar-stream';
import {promisify}                                                                        from 'util';
import zlib                                                                               from 'zlib';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS<PortablePath>,
  prefixPath?: PortablePath | null,
  compressionLevel?: ZipCompression,
}

const gunzip = promisify(zlib.gunzip);

export async function makeArchiveFromDirectory(source: PortablePath, {baseFs = new NodeFS(), prefixPath = PortablePath.root, compressionLevel}: MakeArchiveFromDirectoryOptions = {}): Promise<ZipFS> {
  const tmpFolder = await xfs.mktempPromise();
  const tmpFile = ppath.join(tmpFolder, `archive.zip` as Filename);

  const zipFs = new ZipFS(tmpFile, {create: true, libzip: await getLibzipPromise(), level: compressionLevel});
  const target = ppath.resolve(PortablePath.root, prefixPath!);

  await zipFs.copyPromise(target, source, {baseFs, stableTime: true, stableSort: true});

  return zipFs;
}

interface ExtractBufferOptions {
  compressionLevel?: ZipCompression,
  prefixPath?: PortablePath,
  stripComponents?: number,
}

export async function convertToZip(tgz: Buffer, opts: ExtractBufferOptions) {
  const tmpFolder = await xfs.mktempPromise();
  const tmpFile = ppath.join(tmpFolder, `archive.zip` as Filename);
  const {compressionLevel, ...bufferOpts} = opts;

  return await extractArchiveTo(tgz, new ZipFS(tmpFile, {create: true, libzip: await getLibzipPromise(), level: compressionLevel}), bufferOpts);
}

export async function extractArchiveTo<T extends FakeFS<PortablePath>>(tgz: Buffer, targetFs: T, {stripComponents = 0, prefixPath = PortablePath.dot}: ExtractBufferOptions = {}): Promise<T> {
  // 1980-01-01, like Fedora
  const defaultTime = 315532800;

  const parser = tar.extract() as tar.Extract;

  function ignore(entry: tar.Headers) {
    // Disallow absolute paths; might be malicious (ex: /etc/passwd)
    if (entry.name[0] === `/`)
      return true;

    const parts = entry.name.split(/\//g);

    // We also ignore paths that could lead to escaping outside the archive
    if (parts.some((part: string) => part === `..`))
      return true;

    if (parts.length <= stripComponents)
      return true;

    return false;
  }

  parser.on(`entry`, (header, stream, next) => {
    if (ignore(header)) {
      next();
      return;
    }

    const parts = ppath.normalize(npath.toPortablePath(header.name)).replace(/\/$/, ``).split(/\//g);
    if (parts.length <= stripComponents) {
      stream.resume();
      next();
      return;
    }

    const slicePath = parts.slice(stripComponents).join(`/`) as PortablePath;
    const mappedPath = ppath.join(prefixPath, slicePath);

    let mode = 0o644;

    // If a single executable bit is set, normalize so that all are
    if (header.type === `directory` || ((header.mode ?? 0) & 0o111) !== 0)
      mode |= 0o111;

    switch (header.type) {
      case `directory`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

        targetFs.mkdirSync(mappedPath);
        targetFs.chmodSync(mappedPath, mode);
        targetFs.utimesSync(mappedPath, defaultTime, defaultTime);
        next();
      } break;

      case `file`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

        const chunks: Array<Buffer> = [];

        stream.on(`data`, (chunk: Buffer) => chunks.push(chunk));
        stream.on(`end`, () => {
          targetFs.writeFileSync(mappedPath, Buffer.concat(chunks));
          targetFs.chmodSync(mappedPath, mode);
          targetFs.utimesSync(mappedPath, defaultTime, defaultTime);
          next();
        });
      } break;

      case `symlink`: {
        targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

        targetFs.symlinkSync(header.linkname as PortablePath, mappedPath);
        targetFs.lutimesSync?.(mappedPath, defaultTime, defaultTime);
        next();
      } break;

      default: {
        stream.resume();
        next();
      }
    }
  });

  const gunzipped = await gunzip(tgz);

  return await new Promise<T>((resolve, reject) =>  {
    parser.on(`error`, (error: Error) => {
      reject(error);
    });

    parser.on(`finish`, () => {
      resolve(targetFs);
    });

    parser.end(gunzipped);
  });
}
