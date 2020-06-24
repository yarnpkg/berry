import {Filename, FakeFS, PortablePath, ZipCompression, ZipFS, NodeFS, ppath, xfs, npath} from '@yarnpkg/fslib';
import {getLibzipPromise}                                                                 from '@yarnpkg/libzip';
import {Parse}                                                                            from 'tar';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS<PortablePath>,
  prefixPath?: PortablePath | null,
  compressionLevel?: ZipCompression,
}

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

  // @ts-ignore: Typescript doesn't want me to use new
  const parser = new Parse();

  function ignore(entry: any) {
    // Disallow absolute paths; might be malicious (ex: /etc/passwd)
    if (entry[0] === `/`)
      return true;

    const parts = entry.path.split(/\//g);

    // We also ignore paths that could lead to escaping outside the archive
    if (parts.some((part: string) => part === `..`))
      return true;

    if (parts.length <= stripComponents)
      return true;

    return false;
  }

  parser.on(`entry`, (entry: any) => {
    if (ignore(entry)) {
      entry.resume();
      return;
    }

    const parts = ppath.normalize(npath.toPortablePath(entry.path)).replace(/\/$/, ``).split(/\//g);
    if (parts.length <= stripComponents) {
      entry.resume();
      return;
    }

    const slicePath = parts.slice(stripComponents).join(`/`) as PortablePath;
    const mappedPath = ppath.join(prefixPath, slicePath);

    const chunks: Array<Buffer> = [];

    let mode = 0o644;

    // If a single executable bit is set, normalize so that all are
    if (entry.type === `Directory` || (entry.mode & 0o111) !== 0)
      mode |= 0o111;

    entry.on(`data`, (chunk: Buffer) => {
      chunks.push(chunk);
    });

    entry.on(`end`, () => {
      switch (entry.type) {
        case `Directory`: {
          targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          targetFs.mkdirSync(mappedPath);
          targetFs.chmodSync(mappedPath, mode);
          targetFs.utimesSync(mappedPath, defaultTime, defaultTime);
        } break;

        case `OldFile`:
        case `File`: {
          targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          targetFs.writeFileSync(mappedPath, Buffer.concat(chunks));
          targetFs.chmodSync(mappedPath, mode);
          targetFs.utimesSync(mappedPath, defaultTime, defaultTime);
        } break;

        case `SymbolicLink`: {
          targetFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          targetFs.symlinkSync(entry.linkpath, mappedPath);
          targetFs.lutimesSync?.(mappedPath, defaultTime, defaultTime);
        } break;
      }
    });
  });

  return await new Promise<T>((resolve, reject) =>  {
    parser.on(`error`, (error: Error) => {
      reject(error);
    });

    parser.on(`close`, () => {
      resolve(targetFs);
    });

    parser.end(tgz);
  });
}
