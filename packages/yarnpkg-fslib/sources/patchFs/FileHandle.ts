import type {Abortable}                                                 from 'events';
import type {FlagAndOpenMode, FileReadResult, FileReadOptions}          from 'fs/promises';
import {createInterface}                                                from 'readline';

import type {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS} from '../FakeFS';
import type {Path}                                                      from '../path';

import type {
  BigIntStats,
  ObjectEncodingOptions,
  OpenMode,
  ReadStream,
  ReadVResult,
  StatOptions,
  Stats,
  WriteStream,
  WriteVResult,
} from 'fs';

// Implementation based on https://github.com/nodejs/node/blob/v18.12.0/lib/internal/fs/promises.js#L132-L351

type WriteArgsBuffer<TBuffer extends Uint8Array> = [
  buffer: TBuffer,
  offset?: number | null,
  length?: number | null,
  position?: number | null,
];

type WriteArgsString = [
  data: string,
  position?: number | null,
  encoding?: BufferEncoding | null,
];

const kBaseFs = Symbol(`kBaseFs`);
const kFd = Symbol(`kFd`);
const kClosePromise = Symbol(`kClosePromise`);
const kCloseResolve = Symbol(`kCloseResolve`);
const kCloseReject = Symbol(`kCloseReject`);
const kRefs = Symbol(`kRefs`);
const kRef = Symbol(`kRef`);
const kUnref = Symbol(`kUnref`);

export class FileHandle<P extends Path> {
  [kBaseFs]: FakeFS<P>;
  [kFd]: number;
  [kRefs] = 1;
  [kClosePromise]: Promise<void> | undefined = undefined;
  [kCloseResolve]: (() => void) | undefined = undefined;
  [kCloseReject]: (() => void) | undefined = undefined;

  constructor(fd: number, baseFs: FakeFS<P>) {
    this[kBaseFs] = baseFs;
    this[kFd] = fd;
  }

  get fd() {
    return this[kFd];
  }

  async appendFile(
    data: string | Uint8Array,
    options?: (ObjectEncodingOptions & FlagAndOpenMode) | BufferEncoding | null,
  ): Promise<void> {
    try {
      this[kRef](this.appendFile);
      const encoding = (typeof options === `string` ? options : options?.encoding) ?? undefined;
      return await this[kBaseFs].appendFilePromise(this.fd, data, encoding ? {encoding} : undefined);
    } finally {
      this[kUnref]();
    }
  }

  async chown(uid: number, gid: number): Promise<void> {
    try {
      this[kRef](this.chown);
      return await this[kBaseFs].fchownPromise(this.fd, uid, gid);
    } finally {
      this[kUnref]();
    }
  }

  async chmod(mode: number): Promise<void> {
    try {
      this[kRef](this.chmod);
      return await this[kBaseFs].fchmodPromise(this.fd, mode);
    } finally {
      this[kUnref]();
    }
  }

  createReadStream(options?: CreateReadStreamOptions): ReadStream {
    return this[kBaseFs].createReadStream(null, {...options, fd: this.fd});
  }

  createWriteStream(options?: CreateWriteStreamOptions): WriteStream {
    return this[kBaseFs].createWriteStream(null, {...options, fd: this.fd});
  }

  // FIXME: Missing FakeFS version
  datasync(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  sync(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // TODO: Once we drop Node 20 support, switch to ReadOptions and ReadOptionsWithoutBuffer from `@types/node`
  async read<T extends NodeJS.ArrayBufferView>(
    buffer: T,
    offset?: number | null,
    length?: number | null,
    position?: number | null,
  ): Promise<FileReadResult<T>>;
  async read<T extends NodeJS.ArrayBufferView>(
    buffer: T,
    options?: Omit<FileReadOptions<T>, `buffer`>,
  ): Promise<FileReadResult<T>>;
  async read<T extends NodeJS.ArrayBufferView = NonSharedBuffer>(
    options: FileReadOptions<T> & {buffer: T},
  ): Promise<FileReadResult<T>>;
  async read(
    options?: FileReadOptions<NonSharedBuffer> & {buffer?: never},
  ): Promise<FileReadResult<NonSharedBuffer>>;
  async read<T extends NodeJS.ArrayBufferView>(
    bufferOrOptions?: T | FileReadOptions<T>,
    offsetOrOptions?: number | null | Omit<FileReadOptions<T>, `buffer`>,
    length?: number | null,
    position?: number | null,
  ): Promise<FileReadResult<T>> {
    try {
      this[kRef](this.read);

      let buffer: T;
      let offset: number;

      if (!ArrayBuffer.isView(bufferOrOptions)) {
        // read([options])
        // TypeScript isn't able to infer that the coalescing happens only in the no-generic case
        buffer = bufferOrOptions?.buffer ?? Buffer.alloc(16384) as unknown as T;
        offset = bufferOrOptions?.offset ?? 0;
        length = bufferOrOptions?.length ?? buffer.byteLength - offset;
        position = bufferOrOptions?.position ?? null;
      } else if (typeof offsetOrOptions === `object` && offsetOrOptions !== null) {
        // read(buffer[, options])
        buffer = bufferOrOptions;
        offset = offsetOrOptions?.offset ?? 0;
        length = offsetOrOptions?.length ?? buffer.byteLength - offset;
        position = offsetOrOptions?.position ?? null;
      } else {
        // read(buffer, offset[, length[, position]])
        buffer = bufferOrOptions;
        offset = offsetOrOptions ?? 0;
        length ??= 0;
      }

      if (length === 0) {
        return {
          bytesRead: length,
          buffer,
        };
      }

      const bytesRead = await this[kBaseFs].readPromise(
        this.fd,
        // FIXME: FakeFS should support ArrayBufferViews directly
        Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength),
        offset,
        length,
        position,
      );

      return {
        bytesRead,
        buffer,
      };
    } finally {
      this[kUnref]();
    }
  }

  readFile(
    options?: {
      encoding?: null | undefined;
      flag?: OpenMode | undefined;
    } | null
  ): Promise<Buffer>;
  readFile(
    options:
    | {
      encoding: BufferEncoding;
      flag?: OpenMode | undefined;
    }
    | BufferEncoding
  ): Promise<string>;
  async readFile(
    options?:
    | (ObjectEncodingOptions & {
      flag?: OpenMode | undefined;
    })
    | BufferEncoding
    | null,
  ): Promise<string | Buffer> {
    try {
      this[kRef](this.readFile);
      const encoding = (typeof options === `string` ? options : options?.encoding) ?? undefined;
      return await this[kBaseFs].readFilePromise(this.fd, encoding);
    } finally {
      this[kUnref]();
    }
  }

  readLines(options?: CreateReadStreamOptions) {
    return createInterface({
      input: this.createReadStream(options),
      crlfDelay: Infinity,
    });
  }

  stat(
    opts?: StatOptions & {
      bigint?: false | undefined;
    }
  ): Promise<Stats>;
  stat(
    opts: StatOptions & {
      bigint: true;
    }
  ): Promise<BigIntStats>;
  async stat(opts?: StatOptions): Promise<Stats | BigIntStats> {
    try {
      this[kRef](this.stat);
      return await this[kBaseFs].fstatPromise(this.fd, opts);
    } finally {
      this[kUnref]();
    }
  }

  async truncate(len?: number): Promise<void> {
    try {
      this[kRef](this.truncate);
      return await this[kBaseFs].ftruncatePromise(this.fd, len);
    } finally {
      this[kUnref]();
    }
  }

  // FIXME: Missing FakeFS version
  utimes(atime: string | number | Date, mtime: string | number | Date): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  async writeFile(
    data: string | Uint8Array,
    options?: (ObjectEncodingOptions & FlagAndOpenMode & Abortable) | BufferEncoding | null,
  ): Promise<void> {
    try {
      this[kRef](this.writeFile);
      const encoding = (typeof options === `string` ? options : options?.encoding) ?? undefined;
      await this[kBaseFs].writeFilePromise(this.fd, data, encoding);
    } finally {
      this[kUnref]();
    }
  }

  async write(...args: WriteArgsString): Promise<{bytesWritten: number, buffer: string}>;
  async write<TBuffer extends Uint8Array>(...args: WriteArgsBuffer<TBuffer>): Promise<{bytesWritten: number, buffer: TBuffer}>;
  async write<TBuffer extends Uint8Array>(...args: WriteArgsBuffer<TBuffer> | WriteArgsString): Promise<{bytesWritten: number, buffer: string | TBuffer}> {
    try {
      this[kRef](this.write);
      if (ArrayBuffer.isView(args[0])) {
        const [buffer, offset, length, position] = args as WriteArgsBuffer<TBuffer>;
        const bytesWritten = await this[kBaseFs].writePromise(this.fd, buffer as unknown as Buffer, offset ?? undefined, length ?? undefined, position ?? undefined);
        return {bytesWritten, buffer};
      } else {
        const [data, position, encoding] = args as WriteArgsString;
        // @ts-expect-error - FIXME: Types/implementation need to be updated in FakeFS
        const bytesWritten = await this[kBaseFs].writePromise(this.fd, data, position, encoding);
        return {bytesWritten, buffer: data};
      }
    } finally {
      this[kUnref]();
    }
  }

  // TODO: Use writev from FakeFS when that is implemented
  async writev(buffers: Array<NodeJS.ArrayBufferView>, position?: number): Promise<WriteVResult> {
    try {
      this[kRef](this.writev);

      let bytesWritten = 0;

      if (typeof position !== `undefined`) {
        for (const buffer of buffers) {
          const writeResult = await this.write(buffer as unknown as Buffer, undefined, undefined, position);
          bytesWritten += writeResult.bytesWritten;
          position += writeResult.bytesWritten;
        }
      } else {
        for (const buffer of buffers) {
          const writeResult = await this.write(buffer as unknown as Buffer);
          bytesWritten += writeResult.bytesWritten;
        }
      }

      return {
        buffers,
        bytesWritten,
      };
    } finally {
      this[kUnref]();
    }
  }

  // FIXME: Missing FakeFS version
  readv(buffers: ReadonlyArray<NodeJS.ArrayBufferView>, position?: number): Promise<ReadVResult> {
    throw new Error(`Method not implemented.`);
  }

  close(): Promise<void> {
    if (this[kFd] === -1) return Promise.resolve();

    if (this[kClosePromise]) return this[kClosePromise];

    this[kRefs]--;
    if (this[kRefs] === 0) {
      const fd = this[kFd];
      this[kFd] = -1;
      this[kClosePromise] = this[kBaseFs].closePromise(fd).finally(() => {
        this[kClosePromise] = undefined;
      });
    } else {
      this[kClosePromise] =
        new Promise<void>((resolve, reject) => {
          this[kCloseResolve] = resolve;
          this[kCloseReject] = reject;
        }).finally(() => {
          this[kClosePromise] = undefined;
          this[kCloseReject] = undefined;
          this[kCloseResolve] = undefined;
        });
    }

    return this[kClosePromise];
  }

  [kRef](caller: Function) {
    if (this[kFd] === -1) {
      const err = new Error(`file closed`);
      (err as any).code = `EBADF`;
      (err as any).syscall = caller.name;
      throw err;
    }

    this[kRefs]++;
  }

  [kUnref]() {
    this[kRefs]--;
    if (this[kRefs] === 0) {
      const fd = this[kFd];
      this[kFd] = -1;
      this[kBaseFs].closePromise(fd).then(this[kCloseResolve], this[kCloseReject]);
    }
  }
}
