import {Gzip}          from 'zlib';
import {xfs, NodeFS, PortablePath, ppath, Filename}   from '@yarnpkg/fslib';

const klaw = require('klaw');
const tarFs = require('tar-fs');
const tmp = require('tmp');
const zlib = require('zlib');

const miscUtils = require('./misc');

const IS_WIN32 = process.platform === `win32`;

exports.walk = function walk(
  source: PortablePath,
  {filter, relative = false}: {filter?: Array<string>, relative?: boolean} = {},
): Promise<Array<PortablePath>> {
  return new Promise((resolve, reject) => {
    const paths = [];

    const walker = klaw(NodeFS.fromPortablePath(source), {
      filter: itemPath => {
        if (!filter) {
          return true;
        }

        itemPath = NodeFS.toPortablePath(itemPath);
        const stat = xfs.statSync(itemPath);

        if (stat.isDirectory()) {
          return true;
        }

        const relativePath = ppath.relative(source, itemPath);

        if (miscUtils.filePatternMatch(relativePath, filter)) {
          return true;
        }

        return false;
      },
    });

    walker.on('data', ({path: itemPath}) => {
      itemPath = NodeFS.toPortablePath(itemPath);
      const relativePath = ppath.relative(source, itemPath);

      if (!filter || miscUtils.filePatternMatch(relativePath, filter)) {
        paths.push(relative ? relativePath : itemPath);
      }

      // This item has been accepted only because it's a directory; it doesn't match the filter
      return;
    });

    walker.on('end', () => {
      resolve(paths);
    });
  });
};

exports.packToStream = function packToStream(
  source: PortablePath,
  {virtualPath = null}: {virtualPath?: PortablePath | null} = {},
): Gzip {
  if (virtualPath) {
    if (!ppath.isAbsolute(virtualPath)) {
      throw new Error('The virtual path has to be an absolute path');
    } else {
      virtualPath = ppath.resolve(virtualPath);
    }
  }

  const zipperStream = zlib.createGzip();

  const packStream = tarFs.pack(NodeFS.fromPortablePath(source), {
    map: header => {
      header.name = NodeFS.toPortablePath(header.name);

      if (true) {
        header.name = ppath.resolve(PortablePath.root, header.name);
        header.name = ppath.relative(PortablePath.root, header.name);
      }

      if (virtualPath) {
        header.name = ppath.resolve(PortablePath.root, virtualPath, header.name);
        header.name = ppath.relative(PortablePath.root, header.name);
      }

      return header;
    },
  });

  packStream.pipe(zipperStream);

  packStream.on('error', error => {
    zipperStream.emit('error', error);
  });

  return zipperStream;
};

exports.packToFile = function packToFile(target: PortablePath, source: PortablePath, options: any): Promise<void> {
  const tarballStream = xfs.createWriteStream(target);

  const packStream = exports.packToStream(source, options);
  packStream.pipe(tarballStream);

  return new Promise((resolve, reject) => {
    tarballStream.on('error', error => {
      reject(error);
    });

    packStream.on('error', error => {
      reject(error);
    });

    tarballStream.on('close', () => {
      resolve();
    });
  });
};

exports.unpackToDirectory = function unpackToDirectory(target: PortablePath, source: PortablePath): Promise<void> {
  const tarballStream = xfs.createReadStream(source);
  const gunzipStream =  zlib.createUnzip();
  const extractStream = tarFs.extract(NodeFS.fromPortablePath(target));

  tarballStream.pipe(gunzipStream).pipe(extractStream);

  return new Promise((resolve, reject) => {
    tarballStream.on('error', error => {
      reject(error);
    });

    gunzipStream.on('error', error => {
      reject(error);
    });

    extractStream.on('error', error => {
      reject(error);
    });

    extractStream.on('finish', () => {
      resolve();
    });
  });
};

exports.createTemporaryFolder = function createTemporaryFolder(name?: Filename): Promise<PortablePath> {
  return new Promise<string>((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error, dirPath) => {
      if (error) {
        reject(error);
      } else {
        resolve(dirPath);
      }
    });
  }).then(async dirPath => {
    dirPath = await xfs.realpathPromise(NodeFS.toPortablePath(dirPath));

    if (name) {
      dirPath = ppath.join(dirPath, name as PortablePath);
      await exports.mkdirp(dirPath);
    }

    return dirPath;
  });
};

exports.createTemporaryFile = async function createTemporaryFile(filePath: PortablePath): Promise<PortablePath> {
  if (filePath) {
    if (ppath.normalize(filePath).match(/^(\.\.)?\//)) {
      throw new Error('A temporary file path must be a forward path');
    }

    const folderPath = await exports.createTemporaryFolder();
    return ppath.resolve(folderPath, filePath as PortablePath);
  } else {
    return new Promise((resolve, reject) => {
      tmp.file({discardDescriptor: true}, (error, filePath) => {
        if (error) {
          reject(error);
        } else {
          resolve(NodeFS.toPortablePath(filePath));
        }
      });
    });
  }
};

exports.mkdirp = async function mkdirp(target: PortablePath): Promise<void> {
  await xfs.mkdirpPromise(target);
};

exports.writeFile = async function writeFile(target: PortablePath, body: string | Buffer): Promise<void> {
  await xfs.mkdirpPromise(ppath.dirname(target));
  await xfs.writeFilePromise(target, body);
};

exports.readFile = function readFile(source: PortablePath, encoding?: string): Promise<any> {
  return xfs.readFilePromise(source, encoding);
};

exports.writeJson = function writeJson(target: PortablePath, object: any): Promise<void> {
  return exports.writeFile(target, JSON.stringify(object));
};

exports.readJson = async function readJson(source: PortablePath): Promise<any> {
  const fileContent = await exports.readFile(source, 'utf8');

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid json file (${source})`);
  }
};

exports.chmod = async function chmod(target: PortablePath, mod: number): Promise<void> {
  await xfs.chmodPromise(target, mod);
};

exports.realpath = function realpath(source: PortablePath): Promise<PortablePath> {
  return xfs.realpathPromise(source);
};

exports.makeFakeBinary = async function(
  target: PortablePath,
  {output = `Fake binary`, exitCode = 1}: {output?: string, exitCode?: number} = {},
): Promise<void> {
  const realTarget = IS_WIN32 ? `${target}.cmd` as PortablePath : target;
  const header = IS_WIN32 ? `@echo off\n` : `#!/bin/sh\n`;

  await exports.writeFile(realTarget, `${header}printf "%s" "${output}"\nexit ${exitCode}\n`);
  await exports.chmod(realTarget, 0o755);
};
