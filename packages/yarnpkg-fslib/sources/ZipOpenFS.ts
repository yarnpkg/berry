import {Libzip}                                   from '@yarnpkg/libzip';

import {FakeFS}                                   from './FakeFS';
import {GetMountPointFn, MountFS, MountFSOptions} from './MountFS';
import {ZipFS}                                    from './ZipFS';
import {PortablePath, ppath}                      from './path';

/**
 * Extracts the archive part (ending in the first instance of `extension`) from a path.
 *
 * The indexOf-based implementation is ~3.7x faster than a RegExp-based implementation.
 */
export function getArchivePart(path: string, extension: string) {
  let idx = path.indexOf(extension);
  if (idx <= 0)
    return null;

  let nextCharIdx = idx;
  while (idx >= 0) {
    nextCharIdx = idx + extension.length;
    if (path[nextCharIdx] === ppath.sep)
      break;

    // Disallow files named ".zip"
    if (path[idx - 1] === ppath.sep)
      return null;

    idx = path.indexOf(extension, nextCharIdx);
  }

  // The path either has to end in ".zip" or contain an archive subpath (".zip/...")
  if (path.length > nextCharIdx && path[nextCharIdx] !== ppath.sep)
    return null;

  return path.slice(0, nextCharIdx) as PortablePath;
}

export type ZipOpenFSOptions = Omit<MountFSOptions<ZipFS>,
  | `factoryPromise`
  | `factorySync`
  | `getMountPoint`
> & {
  libzip: Libzip | (() => Libzip);
  readOnlyArchives?: boolean;

  /**
   * Which file extensions will be interpreted as zip files. Useful for supporting other formats
   * packaged as zips, such as .docx.
   *
   * If not provided, defaults to only accepting `.zip`.
   */
  fileExtensions?: Array<string> | null;
};

export class ZipOpenFS extends MountFS<ZipFS> {
  static async openPromise<T>(fn: (zipOpenFs: ZipOpenFS) => Promise<T>, opts: ZipOpenFSOptions): Promise<T> {
    const zipOpenFs = new ZipOpenFS(opts);

    try {
      return await fn(zipOpenFs);
    } finally {
      zipOpenFs.saveAndClose();
    }
  }

  constructor(opts: ZipOpenFSOptions) {
    let libzipInstance: Libzip | undefined;

    const libzipFactory: () => Libzip = typeof opts.libzip !== `function`
      ? () => opts.libzip as Exclude<(typeof opts)[`libzip`], Function>
      : opts.libzip;

    const getLibzip = () => {
      if (typeof libzipInstance === `undefined`)
        libzipInstance = libzipFactory();

      return libzipInstance;
    };

    const fileExtensions = opts.fileExtensions;
    const readOnlyArchives = opts.readOnlyArchives;

    const getMountPoint: GetMountPointFn = typeof fileExtensions === `undefined`
      ? path => getArchivePart(path, `.zip`)
      : path => {
        for (const extension of fileExtensions!) {
          const result = getArchivePart(path, extension);
          if (result) {
            return result;
          }
        }

        return null;
      };

    const factorySync = (baseFs: FakeFS<PortablePath>, p: PortablePath) => {
      return new ZipFS(p, {
        baseFs,
        libzip: getLibzip(),
        readOnly: readOnlyArchives,
        stats: baseFs.statSync(p),
      });
    };

    const factoryPromise = async (baseFs: FakeFS<PortablePath>, p: PortablePath) => {
      const zipOptions = {
        baseFs,
        libzip: getLibzip(),
        readOnly: readOnlyArchives,
        stats: await baseFs.statPromise(p),
      };

      return () => {
        return new ZipFS(p, zipOptions);
      };
    };

    super({
      ...opts,

      factorySync,
      factoryPromise,

      getMountPoint,
    });
  }
}
