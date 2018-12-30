import {FakeFS, JailFS, ZipFS, NodeFS} from '@berry/zipfs';
import {posix}                         from 'path';
import {Parse}                         from 'tar';
import {tmpNameSync}                   from 'tmp';

interface MakeArchiveFromDirectoryOptions {
  baseFs?: FakeFS,
  prefixPath?: string | null,
};

export async function makeArchiveFromDirectory(source: string, {baseFs = new NodeFS(), prefixPath = `/`}: MakeArchiveFromDirectoryOptions = {}): Promise<ZipFS> {
  const zipFs = new ZipFS(tmpNameSync(), {create: true});
  const target = posix.resolve(`/`, prefixPath);

  await zipFs.copyPromise(target, source, {baseFs});

  return zipFs;
}

interface MakeArchiveOptions {
  prefixPath?: string | null,
  stripComponents?: number,
};

export async function makeArchive(tgz: Buffer, {stripComponents = 0, prefixPath = `.`}: MakeArchiveOptions = {}): Promise<ZipFS> {
  const zipFs = new ZipFS(tmpNameSync(), {create: true});

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
    const mappedPath = posix.join(prefixPath, parts.slice(stripComponents).join(`/`));

    const chunks: Array<Buffer> = [];

    entry.on(`data`, (chunk: Buffer) => {
      chunks.push(chunk);
    });

    entry.on(`end`, () => {
      switch (entry.type) {
        case `Directory`: {
          zipFs.mkdirpSync(mappedPath);
        } break;

        case `OldFile`:
        case `File`: {
          zipFs.mkdirpSync(posix.dirname(mappedPath));
          zipFs.writeFileSync(mappedPath, Buffer.concat(chunks));
          zipFs.chmodSync(mappedPath, entry.mode);
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
