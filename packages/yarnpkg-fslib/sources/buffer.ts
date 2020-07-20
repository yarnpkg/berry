import {NativePath, PortablePath, Path, PathUtils, PathLike, PathType, ppath, npath} from './path';

export const PATH_BUFFER_ENCODING = `latin1`;

export abstract class BasePathBuffer<P extends Path> extends Buffer {
  declare public toString: (encoding?: BufferEncoding, start?: number, end?: number) => P;

  protected constructor(pathUtils: PathUtils<P>, p: PathLike<P>) {
    super(pathUtils.fromPathLike(p), PATH_BUFFER_ENCODING);
  }
}

export class PortablePathBuffer extends BasePathBuffer<PortablePath> {
  declare _path_type: PathType.Portable;

  constructor(p: PathLike<PortablePath>) {
    super(ppath, p);
  }
}

export class NativePathBuffer extends BasePathBuffer<NativePath> {
  declare _path_type?: PathType.Native;

  constructor(p: PathLike<NativePath>) {
    super(npath, p);
  }
}

export type PathBuffer<T extends Path = Path> = T extends PortablePath ? PortablePathBuffer : NativePathBuffer;

export type PathBufferConstructor<T extends Path = Path> = T extends PortablePath ? typeof PortablePathBuffer : typeof NativePathBuffer;
