import {FakeFS, PortablePath, ZipFS, NodeFS, ppath} from '@yarnpkg/fslib';
import {Parse}                                      from 'tar';
import {tmpNameSync}                                from 'tmp';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS<PortablePath>,
  prefixPath?: PortablePath | null,
};

export async function makeArchiveFromDirectory(source: PortablePath, {baseFs = new NodeFS(), prefixPath = PortablePath.root}: MakeArchiveFromDirectoryOptions = {}): Promise<ZipFS> {
  const zipFs = new ZipFS(NodeFS.toPortablePath(tmpNameSync()), {create: true});
  const target = ppath.resolve(PortablePath.root, prefixPath!);

  await zipFs.copyPromise(target, source, {baseFs});

  return zipFs;
}

interface MakeArchiveOptions {
  prefixPath?: PortablePath,
  stripComponents?: number,
};

export async function makeArchive(tgz: Buffer, {stripComponents = 0, prefixPath = PortablePath.dot}: MakeArchiveOptions = {}): Promise<ZipFS> {
  const zipFs = new ZipFS(NodeFS.toPortablePath(tmpNameSync()), {create: true});

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

    const parts = entry.path.split(/\//g);
    const mappedPath = ppath.join(prefixPath, parts.slice(stripComponents).join(`/`));

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
          zipFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          zipFs.mkdirSync(mappedPath);
          zipFs.chmodSync(mappedPath, mode);
          zipFs.utimesSync(mappedPath, defaultTime, defaultTime);
        } break;

        case `OldFile`:
        case `File`: {
          zipFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          zipFs.writeFileSync(mappedPath, Buffer.concat(chunks));
          zipFs.chmodSync(mappedPath, mode);
          zipFs.utimesSync(mappedPath, defaultTime, defaultTime);
        } break;

        case `SymbolicLink`: {
          zipFs.mkdirpSync(ppath.dirname(mappedPath), {chmod: 0o755, utimes: [defaultTime, defaultTime]});

          zipFs.symlinkSync(entry.linkpath, mappedPath);
          zipFs.lutimesSync(mappedPath, defaultTime, defaultTime);
        } break;
      }
    });
  });

  return await new Promise<ZipFS>((resolve, reject) =>  {
    parser.on(`error`, (error: Error) => {
      reject(error);
    });

    parser.on(`close`, () => {
      resolve(zipFs);
    });

    parser.end(tgz);
  });
}
