import {PortablePath}                                                from '@yarnpkg/fslib';
import {Libzip}                                                      from '@yarnpkg/libzip';

import {ZipImplInput, type CompressionData, type Stat, type ZipImpl} from './ZipFS';
import {newInstance}                                                 from './instance';


export class LibzipError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);

    this.name = `Libzip Error`;
    this.code = code;
  }
}


type LibzipInstance = {instance: Libzip | null, active: boolean, reserved: number, highWaterMark: number};
type LibzipReservation = {byteLength: number, instanceIndex: number};
/**
 * Tracks the estimate of WASM memory usage by libzip to reduce the risk
 * of OOM errors.
 *
 * Internally, favors the oldest WASM instances to minimize fragmentation.
 * Cleans up instances when older instances have space to accomodate new zips.
 */
class ElasticLibzipFactory {
  private static readonly LIBZIP_METADATA = 512 * 1024; // 500KB
  private static readonly WASM_MEM_MAX = 2 * 1024 * 1024 * 1024 - (100 * 1024 * 1024); // 1.9GB
  private static KEY = 1;

  /**
   * The WASM instances, their currently reserved memory, and the high water mark, since
   * WASM memory isn't usually shrinkable.
   */
  private readonly instances: Array<LibzipInstance> = [];
  /**
   * The reservations by unique ID, and the index into the {@link instances} array.
   */
  private readonly reservations = new Map<number, LibzipReservation>();

  /**
   * Provide (and possibly build new) a libzip WASM for the given ZIP byte length
   *
   * @param byteLength The size of the ZIP file
   * @returns [unique ID, Libzip instance]
   */
  getInstance(byteLength: number): [number, Libzip] {
    const size = byteLength + ElasticLibzipFactory.LIBZIP_METADATA;
    let index = this.instances.findIndex(i => i.active && (i.reserved + size) < ElasticLibzipFactory.WASM_MEM_MAX);
    let instance;

    if (index >= 0) {
      instance = this.instances[index];
      instance.reserved += size;
      instance.highWaterMark = Math.max(instance.highWaterMark, instance.reserved);
    } else {
      index = this.instances.length;
      instance = {instance: newInstance(), reserved: size, highWaterMark: size, active: true};
      this.instances.push(instance);
    }
    ElasticLibzipFactory.KEY += 1;
    this.reservations.set(ElasticLibzipFactory.KEY, {byteLength: size, instanceIndex: index});
    return [ElasticLibzipFactory.KEY, instance.instance!];
  }

  remove(key: number) {
    const reservation = this.reservations.get(key);
    if (!reservation)
      return;

    this.reservations.delete(key);

    const instance = this.instances[reservation.instanceIndex];
    instance.reserved -= reservation.byteLength;
    this.cleanup(reservation);
  }

  /**
   * Remove the reservation's instance if the previous one has enough space,
   * or if the reservations instance is nearly out of memory.
   *
   * @param reservation
   */
  private cleanup(reservation: LibzipReservation) {
    const instance = this.instances[reservation.instanceIndex];

    if (instance.reserved <= 0) {
      instance.active = false;
      this.instances[reservation.instanceIndex].instance = null;
    }
  }
}

const libzipFactory = new ElasticLibzipFactory();

export class LibZipImpl implements ZipImpl {
  private readonly libzip: Libzip;
  private readonly lzSource: number;
  private readonly zip: number;
  private readonly listings: Array<string>;
  private readonly symlinkCount: number;
  private readonly key: number;

  public filesShouldBeCached = true;

  constructor(opts: ZipImplInput) {
    const buffer = `buffer` in opts
      ? opts.buffer
      : opts.baseFs.readFileSync(opts.path);

    [this.key, this.libzip] = libzipFactory.getInstance(buffer.byteLength);

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
    } catch(error) {
      libzipFactory.remove(this.key);
      throw error;
    } finally {
      this.libzip.free(errPtr);
    }

    const entryCount = this.libzip.getNumEntries(this.zip, 0);

    this.listings = new Array<string>(entryCount);
    for (let t = 0; t < entryCount; ++t)
      this.listings[t] = this.libzip.getName(this.zip, t, 0);

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
      libzipFactory.remove(this.key);
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
    libzipFactory.remove(this.key);
  }
}
