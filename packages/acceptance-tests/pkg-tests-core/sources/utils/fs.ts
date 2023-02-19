import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}                       from '@yarnpkg/parsers';
import klaw                              from 'klaw';
import stream                            from 'stream';
import tarFs                             from 'tar-fs';
import {promisify}                       from 'util';
import zlib, {Gzip}                      from 'zlib';

import {execPromise}                     from './exec';
import * as miscUtils                    from './misc';

// TODO: Use stream.promises.pipeline when dropping support for Node.js < 15.0.0
const pipelinePromise = promisify(stream.pipeline);

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

  return stream.pipeline(packStream, zlib.createGzip(), () => {});
};

export const packToFile = async (target: PortablePath, source: PortablePath, options: {virtualPath?: PortablePath | null}): Promise<void> => {
  await pipelinePromise(
    packToStream(source, options),
    xfs.createWriteStream(target),
  );
};

export const unpackToDirectory = async (target: PortablePath, source: PortablePath): Promise<void> => {
  await pipelinePromise(
    xfs.createReadStream(source),
    zlib.createUnzip(),
    tarFs.extract(npath.fromPortablePath(target)),
  );
};

export const writeFile = async (target: PortablePath, body: string | Buffer): Promise<void> => {
  await xfs.mkdirpPromise(ppath.dirname(target));
  await xfs.writeFilePromise(target, body);
};

export const writeJson = (target: PortablePath, object: any): Promise<void> => {
  return writeFile(target, JSON.stringify(object));
};

export const readSyml = async (source: PortablePath): Promise<any> => {
  const fileContent = await xfs.readFilePromise(source, `utf8`);

  try {
    return parseSyml(fileContent);
  } catch (error) {
    throw new Error(`Invalid syml file (${source})`);
  }
};

export const makeFakeBinary = async (
  target: PortablePath,
  {output = `Fake binary`, exitCode = 1}: {output?: string, exitCode?: number} = {},
): Promise<void> => {
  const realTarget = IS_WIN32 ? `${target}.cmd` as PortablePath : target;
  const header = IS_WIN32 ? `@echo off\n` : `#!/bin/sh\n`;

  await writeFile(realTarget, `${header}printf "%s" "${output}"\nexit ${exitCode}\n`);
  await xfs.chmodPromise(realTarget, 0o755);
};

export enum FsLinkType {
  SYMBOLIC,
  NTFS_JUNCTION,
  UNKNOWN,
}

export const determineLinkType = async function(path: PortablePath) {
  const stats = await xfs.lstatPromise(path);

  if (!stats.isSymbolicLink())
    return FsLinkType.UNKNOWN;
  if (!IS_WIN32)
    return FsLinkType.SYMBOLIC;

  // Must spawn a process to determine link type on Windows (or include native code)
  // `dir` the directory, toss lines that start with whitespace (header/footer), check for type of path passed in
  const {stdout: dirOutput} = (await execPromise(`dir /al /l`, {shell: `cmd.exe`, cwd: npath.fromPortablePath(ppath.dirname(path))}));
  const linkType = new RegExp(`^\\S.*<(?<linkType>.+)>.*\\s${ppath.basename(path)}(?:\\s|$)`, `gm`).exec(dirOutput)?.groups?.linkType;

  switch (linkType) {
    case `SYMLINK`:
    case `SYMLINKD`:
      return FsLinkType.SYMBOLIC;
    case `JUNCTION`:
      return FsLinkType.NTFS_JUNCTION;
    default:
      return FsLinkType.UNKNOWN;
  }
};
