import {PortablePath}                                                from '@yarnpkg/fslib';
import {Libzip}                                                      from '@yarnpkg/libzip';

import {ZipImplInput, type CompressionData, type Stat, type ZipImpl} from './ZipFS';
import {getInstance}                                                 from './instance';


export class LibzipError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);

    this.name = `Libzip Error`;
    this.code = code;
  }
}

export class LibZipImpl implements ZipImpl {
  private readonly libzip: Libzip;
  private readonly lzSource: number;
  private readonly zip: number;
  private readonly listings: Array<string>;
  private readonly symlinkCount: number;

  public filesShouldBeCached = true;

  constructor(opts: ZipImplInput) {
    const buffer = `buffer` in opts
      ? opts.buffer
      : opts.baseFs.readFileSync(opts.path);

    this.libzip = getInstance();

    const errPtr = this.libzip.malloc(4);
    try {
      let flags = 0;
      if (opts.readOnly)
        flags |= this.libzip.ZIP_RDONLY;

      const lzSource = this.allocateUnattachedSource(buffer);
      try {
        this.zip = this.libzip.openFromSource(lzSource, flags, errPtr);
        this.lzSource = lzSource;
      } catch (error) {
        this.libzip.source.free(lzSource);
        throw error;
      }

      if (this.zip === 0) {
        const error = this.libzip.struct.errorS();
        this.libzip.error.initWithCode(error, this.libzip.getValue(errPtr, `i32`));

        throw this.makeLibzipError(error);
      }
    } finally {
      this.libzip.free(errPtr);
    }

    const entryCount = this.libzip.getNumEntries(this.zip, 0);

    const listings = new Array<string>(entryCount);
    for (let t = 0; t < entryCount; ++t)
      listings[t] = this.libzip.getName(this.zip, t, 0);

    this.listings = listings;

    this.symlinkCount = this.libzip.ext.countSymlinks(this.zip);
    if (this.symlinkCount === -1) {
      throw this.makeLibzipError(this.libzip.getError(this.zip));
    }
  }

  getSymlinkCount() {
    return this.symlinkCount;
  }

  getListings(): Array<string> {
    return this.listings;
  }

  stat(entry: number): Stat {
    const stat = this.libzip.struct.statS();

    const rc = this.libzip.statIndex(this.zip, entry, 0, 0, stat);
    if (rc === -1)
      throw this.makeLibzipError(this.libzip.getError(this.zip));

    const size = (this.libzip.struct.statSize(stat) >>> 0);
    const mtime = (this.libzip.struct.statMtime(stat) >>> 0);

    const crc = this.libzip.struct.statCrc(stat) >>> 0;

    return {size, mtime, crc};
  }

  makeLibzipError(error: number) {
    const errorCode = this.libzip.struct.errorCodeZip(error);
    const strerror = this.libzip.error.strerror(error);

    const libzipError = new LibzipError(strerror, this.libzip.errors[errorCode]);

    // This error should never come up because of the file source cache
    if (errorCode === this.libzip.errors.ZIP_ER_CHANGED)
      throw new Error(`Assertion failed: Unexpected libzip error: ${libzipError.message}`);

    return libzipError;
  }

  setFileSource(target: PortablePath, compression: CompressionData, buffer: Buffer) {
    const lzSource = this.allocateSource(buffer);

    try {
      const newIndex = this.libzip.file.add(this.zip, target, lzSource, this.libzip.ZIP_FL_OVERWRITE);
      if (newIndex === -1)
        throw this.makeLibzipError(this.libzip.getError(this.zip));

      if (compression !== null) {
        const rc = this.libzip.file.setCompression(this.zip, newIndex, 0, compression[0], compression[1]);
        if (rc === -1) {
          throw this.makeLibzipError(this.libzip.getError(this.zip));
        }
      }
      return newIndex;
    } catch (error) {
      this.libzip.source.free(lzSource);
      throw error;
    }
  }

  setMtime(entry: number, mtime: number): void {
    const rc = this.libzip.file.setMtime(this.zip, entry, 0, mtime, 0);
    if (rc === -1) {
      throw this.makeLibzipError(this.libzip.getError(this.zip));
    }
  }

  getExternalAttributes(index: number): [number, number] {
    const attrs = this.libzip.file.getExternalAttributes(this.zip, index, 0, 0, this.libzip.uint08S, this.libzip.uint32S);
    if (attrs === -1)
      throw this.makeLibzipError(this.libzip.getError(this.zip));

    const opsys = this.libzip.getValue(this.libzip.uint08S, `i8`) >>> 0;
    const attributes = this.libzip.getValue(this.libzip.uint32S, `i32`) >>> 0;
    return [opsys, attributes];
  }

  setExternalAttributes(index: number, opsys: number, attributes: number): void {
    const rc = this.libzip.file.setExternalAttributes(this.zip, index, 0, 0, opsys, attributes);
    if (rc === -1) {
      throw this.makeLibzipError(this.libzip.getError(this.zip));
    }
  }

  locate(name: string): number {
    return this.libzip.name.locate(this.zip, name, 0);
  }

  getFileSource(index: number) {
    const stat = this.libzip.struct.statS();

    const rc = this.libzip.statIndex(this.zip, index, 0, 0, stat);
    if (rc === -1)
      throw this.makeLibzipError(this.libzip.getError(this.zip));

    const size = this.libzip.struct.statCompSize(stat);
    const compressionMethod = this.libzip.struct.statCompMethod(stat);
    const buffer = this.libzip.malloc(size);

    try {
      const file = this.libzip.fopenIndex(this.zip, index, 0, this.libzip.ZIP_FL_COMPRESSED);
      if (file === 0)
        throw this.makeLibzipError(this.libzip.getError(this.zip));

      try {
        const rc = this.libzip.fread(file, buffer, size, 0);

        if (rc === -1)
          throw this.makeLibzipError(this.libzip.file.getError(file));
        else if (rc < size)
          throw new Error(`Incomplete read`);
        else if (rc > size)
          throw new Error(`Overread`);

        const memory = this.libzip.HEAPU8.subarray(buffer, buffer + size);
        const data = Buffer.from(memory);

        return {data, compressionMethod};
      } finally {
        this.libzip.fclose(file);
      }
    } finally {
      this.libzip.free(buffer);
    }
  }

  deleteEntry(index: number) {
    const rc = this.libzip.delete(this.zip, index);
    if (rc === -1) {
      throw this.makeLibzipError(this.libzip.getError(this.zip));
    }
  }

  addDirectory(path: string): number {
    const index = this.libzip.dir.add(this.zip, path);
    if (index === -1)
      throw this.makeLibzipError(this.libzip.getError(this.zip));

    return index;
  }

  getBufferAndClose() {
    try {
      // Prevent close from cleaning up the source
      this.libzip.source.keep(this.lzSource);

      // Close the zip archive
      if (this.libzip.close(this.zip) === -1)
        throw this.makeLibzipError(this.libzip.getError(this.zip));

      // Open the source for reading
      if (this.libzip.source.open(this.lzSource) === -1)
        throw this.makeLibzipError(this.libzip.source.error(this.lzSource));

      // Move to the end of source
      if (this.libzip.source.seek(this.lzSource, 0, 0, this.libzip.SEEK_END) === -1)
        throw this.makeLibzipError(this.libzip.source.error(this.lzSource));

      // Get the size of source
      const size = this.libzip.source.tell(this.lzSource);
      if (size === -1)
        throw this.makeLibzipError(this.libzip.source.error(this.lzSource));

      // Move to the start of source
      if (this.libzip.source.seek(this.lzSource, 0, 0, this.libzip.SEEK_SET) === -1)
        throw this.makeLibzipError(this.libzip.source.error(this.lzSource));

      const buffer = this.libzip.malloc(size);
      if (!buffer)
        throw new Error(`Couldn't allocate enough memory`);

      try {
        const rc = this.libzip.source.read(this.lzSource, buffer, size);

        if (rc === -1)
          throw this.makeLibzipError(this.libzip.source.error(this.lzSource));
        else if (rc < size)
          throw new Error(`Incomplete read`);
        else if (rc > size)
          throw new Error(`Overread`);

        let result = Buffer.from(this.libzip.HEAPU8.subarray(buffer, buffer + size));

        if (process.env.YARN_IS_TEST_ENV && process.env.YARN_ZIP_DATA_EPILOGUE)
          result = Buffer.concat([result, Buffer.from(process.env.YARN_ZIP_DATA_EPILOGUE)]);

        return result;
      } finally {
        this.libzip.free(buffer);
      }
    } finally {
      this.libzip.source.close(this.lzSource);
      this.libzip.source.free(this.lzSource);
    }
  }

  private allocateBuffer(content: string | Buffer | ArrayBuffer | DataView) {
    if (!Buffer.isBuffer(content))
      content = Buffer.from(content as any);

    const buffer = this.libzip.malloc(content.byteLength);
    if (!buffer)
      throw new Error(`Couldn't allocate enough memory`);

    // Copy the file into the Emscripten heap
    const heap = new Uint8Array(this.libzip.HEAPU8.buffer, buffer, content.byteLength);
    heap.set(content as any);

    return {buffer, byteLength: content.byteLength};
  }

  private allocateUnattachedSource(content: string | Buffer | ArrayBuffer | DataView) {
    const error = this.libzip.struct.errorS();

    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = this.libzip.source.fromUnattachedBuffer(buffer, byteLength, 0, 1, error);

    if (source === 0) {
      this.libzip.free(error);
      throw this.makeLibzipError(error);
    }

    return source;
  }

  private allocateSource(content: string | Buffer | ArrayBuffer | DataView) {
    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = this.libzip.source.fromBuffer(this.zip, buffer, byteLength, 0, 1);

    if (source === 0) {
      this.libzip.free(buffer);
      throw this.makeLibzipError(this.libzip.getError(this.zip));
    }

    return source;
  }

  public discard(): void {
    this.libzip.discard(this.zip);
  }
}
