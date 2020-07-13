import {NativePath, PortablePath, Path, PathUtils, PathLike, PathType, ppath, npath} from './path';

export class BasePathBuffer<P extends Path> extends Buffer {
  declare public toString: (encoding?: string, start?: number, end?: number) => P;

  protected constructor(pathUtils: PathUtils<P>, p: PathLike<P>, encoding?: BufferEncoding) {
    super(pathUtils.fromPathLike(p), encoding);
  }
}

export class PortablePathBuffer extends BasePathBuffer<PortablePath> {
  declare _path_type: PathType.Portable | PathType.File;

  constructor(p: PathLike<PortablePath>, encoding?: BufferEncoding) {
    super(ppath, p, encoding);
  }
}

export class NativePathBuffer extends BasePathBuffer<NativePath> {
  declare _path_type?: PathType.Native | PathType.File;

  constructor(p: PathLike<NativePath>, encoding?: BufferEncoding) {
    super(npath, p, encoding);
  }
}

export type PathBuffer<T extends Path = Path> = T extends PortablePath ? PortablePathBuffer : NativePathBuffer;

export type PathBufferConstructor<T extends Path = Path> = T extends PortablePath ? typeof PortablePathBuffer : typeof NativePathBuffer;
