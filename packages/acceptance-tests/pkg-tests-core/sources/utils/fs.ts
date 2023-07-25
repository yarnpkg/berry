import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}                       from '@yarnpkg/parsers';
import stream                            from 'stream';
import tarFs                             from 'tar-fs';
import zlib, {Gzip}                      from 'zlib';

import {execPromise}                     from './exec';

const IS_WIN32 = process.platform === `win32`;

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
  await stream.promises.pipeline(
    packToStream(source, options),
    xfs.createWriteStream(target),
  );
};

export const unpackToDirectory = async (target: PortablePath, source: PortablePath): Promise<void> => {
  await stream.promises.pipeline(
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
