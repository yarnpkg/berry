import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {stringifySyml, parseSyml}                  from '@yarnpkg/parsers';
import klaw                                        from 'klaw';
import tarFs                                       from 'tar-fs';
import zlib                                        from 'zlib';
import {Gzip}                                      from 'zlib';

import * as miscUtils                              from './misc';

const IS_WIN32 = process.platform === `win32`;

export const walk = (
  source: PortablePath,
  {filter, relative = false}: {filter?: Array<string>, relative?: boolean} = {},
): Promise<Array<PortablePath>> => {
  return new Promise(resolve => {
    const paths: Array<PortablePath> = [];

    const walker = klaw(npath.fromPortablePath(source), {
      filter: (sourcePath: string) => {
        if (!filter)
          return true;

        const itemPath = npath.toPortablePath(sourcePath);
        const stat = xfs.statSync(itemPath);

        if (stat.isDirectory())
          return true;

        const relativePath = ppath.relative(source, itemPath);

        if (miscUtils.filePatternMatch(relativePath, filter))
          return true;

        return false;
      },
    });

    walker.on(`data`, ({path: sourcePath}) => {
      const itemPath = npath.toPortablePath(sourcePath);
      const relativePath = ppath.relative(source, itemPath);

      if (!filter || miscUtils.filePatternMatch(relativePath, filter))
        paths.push(relative ? relativePath : itemPath);

      // This item has been accepted only because it's a directory; it doesn't match the filter
      return;
    });

    walker.on(`end`, () => {
      resolve(paths);
    });
  });
};

export const packToStream = (
  source: PortablePath,
  {virtualPath = null}: {virtualPath?: PortablePath | null} = {},
): Gzip => {
  if (virtualPath) {
    if (!ppath.isAbsolute(virtualPath)) {
      throw new Error(`The virtual path has to be an absolute path`);
    } else {
      virtualPath = ppath.resolve(virtualPath);
    }
  }

  const zipperStream = zlib.createGzip();

  const packStream = tarFs.pack(npath.fromPortablePath(source), {
    map: (header: any) => {
      header.name = npath.toPortablePath(header.name);

      header.name = ppath.resolve(PortablePath.root, header.name);
      header.name = ppath.relative(PortablePath.root, header.name);

      if (virtualPath) {
        header.name = ppath.resolve(PortablePath.root, virtualPath, header.name);
        header.name = ppath.relative(PortablePath.root, header.name);
      }

      header.uid = 1;
      header.gid = 1;
      header.mtime = new Date(1589272747277);

      return header;
    },
  });

  packStream.pipe(zipperStream);

  packStream.on(`error`, error => {
    zipperStream.emit(`error`, error);
  });

  return zipperStream;
};

export const packToFile = (target: PortablePath, source: PortablePath, options: {virtualPath?: PortablePath | null}): Promise<void> => {
  const tarballStream = xfs.createWriteStream(target);

  const packStream = exports.packToStream(source, options);
  packStream.pipe(tarballStream);

  return new Promise((resolve, reject) => {
    tarballStream.on(`error`, (error: Error) => {
      reject(error);
    });

    packStream.on(`error`, (error: Error) => {
      reject(error);
    });

    tarballStream.on(`close`, () => {
      resolve();
    });
  });
};

export const unpackToDirectory = (target: PortablePath, source: PortablePath): Promise<void> => {
  const tarballStream = xfs.createReadStream(source);
  const gunzipStream =  zlib.createUnzip();
  const extractStream = tarFs.extract(npath.fromPortablePath(target));

  tarballStream.pipe(gunzipStream).pipe(extractStream);

  return new Promise((resolve, reject) => {
    tarballStream.on(`error`, error => {
      reject(error);
    });

    gunzipStream.on(`error`, error => {
      reject(error);
    });

    extractStream.on(`error`, error => {
      reject(error);
    });

    extractStream.on(`finish`, () => {
      resolve();
    });
  });
};

export const createTemporaryFolder = async (name?: Filename): Promise<PortablePath> => {
  let tmp = await xfs.mktempPromise();

  if (typeof name !== `undefined`) {
    tmp = ppath.join(tmp, name);
    await xfs.mkdirPromise(tmp);
  }

  return tmp;
};

export const createTemporaryFile = async (filePath: PortablePath = `file` as PortablePath): Promise<PortablePath> => {
  if (ppath.normalize(filePath).match(/^(\.\.)?\//))
    throw new Error(`A temporary file path must be a forward path`);

  const folderPath = await exports.createTemporaryFolder();
  return ppath.resolve(folderPath, filePath as PortablePath);
};

export const mkdirp = async (target: PortablePath): Promise<void> =>
  await xfs.mkdirpPromise(target);

export const writeFile = async (target: PortablePath, body: string | Buffer): Promise<void> => {
  await xfs.mkdirpPromise(ppath.dirname(target));
  await xfs.writeFilePromise(target, body);
};

export const readFile = (source: PortablePath, encoding?: string): Promise<any> => {
  return xfs.readFilePromise(source, encoding);
};

export const writeJson = (target: PortablePath, object: any): Promise<void> => {
  return exports.writeFile(target, JSON.stringify(object));
};

export const writeSyml = (target: PortablePath, object: any): Promise<void> => {
  return exports.writeFile(target, stringifySyml(object));
};

export const readJson = async (source: PortablePath): Promise<any> => {
  const fileContent = await exports.readFile(source, `utf8`);

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid json file (${source})`);
  }
};

export const readSyml = async (source: PortablePath): Promise<any> => {
  const fileContent = await exports.readFile(source, `utf8`);

  try {
    return parseSyml(fileContent);
  } catch (error) {
    throw new Error(`Invalid syml file (${source})`);
  }
};

export const chmod = async (target: PortablePath, mod: number): Promise<void> => {
  await xfs.chmodPromise(target, mod);
};

export const realpath = (source: PortablePath): Promise<PortablePath> => {
  return xfs.realpathPromise(source);
};

export const makeFakeBinary = async (
  target: PortablePath,
  {output = `Fake binary`, exitCode = 1}: {output?: string, exitCode?: number} = {},
): Promise<void> => {
  const realTarget = IS_WIN32 ? `${target}.cmd` as PortablePath : target;
  const header = IS_WIN32 ? `@echo off\n` : `#!/bin/sh\n`;

  await exports.writeFile(realTarget, `${header}printf "%s" "${output}"\nexit ${exitCode}\n`);
  await exports.chmod(realTarget, 0o755);
};
