import type {BigIntStats, ReadStream, StatOptions, Stats, WriteStream, WriteVResult} from 'fs';

import type {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS}              from '../FakeFS';
import type {Path}                                                                   from '../path';

// Types copied from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/9e2e5af93f9cc2cf434a96e3249a573100e87351/types/node/v16
// Implementation based on https://github.com/nodejs/node/blob/10493b48c7edb227c13a493d0a2c75efe878d7e9/lib/internal/fs/promises.js#L124-L336

interface ObjectEncodingOptions {
  encoding?: BufferEncoding | null | undefined;
}

interface FlagAndOpenMode {
  mode?: Mode | undefined;
  flag?: OpenMode | undefined;
}

type OpenMode = number | string;
type Mode = number | string;

interface FileReadResult<T extends ArrayBufferView> {
  bytesRead: number;
  buffer: T;
}

interface FileReadOptions<T extends ArrayBufferView = Buffer> {
  buffer?: T;
  offset?: number | null;
  length?: number | null;
  position?: number | null;
}

interface ReadVResult {
  bytesRead: number;
  buffers: Array<NodeJS.ArrayBufferView>;
}

interface AbortSignal {
  readonly aborted: boolean;
}

interface Abortable {
  signal?: AbortSignal | undefined;
}

// TODO: Implement the Ref counter
export class FileHandle<P extends Path> {
  #baseFs: FakeFS<P>;
  constructor(public fd: number, baseFs: FakeFS<P>) {
    this.#baseFs = baseFs;
  }

  appendFile(
    data: string | Uint8Array,
    options?: (ObjectEncodingOptions & FlagAndOpenMode) | BufferEncoding | null,
  ): Promise<void> {
    const encoding = (typeof options === `string` ? options : options?.encoding) ?? undefined;
    return this.#baseFs.appendFilePromise(this.fd, data, encoding ? {encoding} : undefined);
  }

  // FIXME: Missing FakeFS version
  chown(uid: number, gid: number): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  chmod(mode: Mode): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  createReadStream(options?: CreateReadStreamOptions): ReadStream {
    // TODO: Implement ref counter
    return this.#baseFs.createReadStream(null, {...options, fd: this.fd});
  }

  createWriteStream(options?: CreateWriteStreamOptions): WriteStream {
    // TODO: Implement ref counter
    return this.#baseFs.createWriteStream(null, {...options, fd: this.fd});
  }

  // FIXME: Missing FakeFS version
  datasync(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  sync(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  async read(options?: FileReadOptions<Buffer>): Promise<FileReadResult<Buffer>>;
  async read(
    buffer: Buffer,
    offset?: number | null,
    length?: number | null,
    position?: number | null
  ): Promise<FileReadResult<Buffer>>;
  async read(
    bufferOrOptions?: Buffer | FileReadOptions<Buffer>,
    offset?: number | null,
    length?: number | null,
    position?: number | null,
  ): Promise<FileReadResult<Buffer>> {
    let buffer: Buffer;

    if (!Buffer.isBuffer(bufferOrOptions)) {
      bufferOrOptions ??= {};
      buffer = bufferOrOptions.buffer ?? Buffer.alloc(16384);
      offset = bufferOrOptions.offset || 0;
      length = bufferOrOptions.length ?? buffer.byteLength;
      position = bufferOrOptions.position ?? null;
    } else {
      buffer = bufferOrOptions;
    }

    offset ??= 0;
    length ??= 0;

    if (length === 0) {
      return {
        bytesRead: length,
        buffer,
      };
    }

    const bytesRead = await this.#baseFs.readPromise(this.fd, buffer, offset, length, position);

    return {
      bytesRead,
      buffer,
    };
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
  readFile(
    options?:
    | (ObjectEncodingOptions & {
      flag?: OpenMode | undefined;
    })
    | BufferEncoding
    | null,
  ): Promise<string | Buffer> {
    const encoding = (typeof options === `string` ? options : options?.encoding) ?? undefined;
    return this.#baseFs.readFilePromise(this.fd, encoding);
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
  stat(opts?: StatOptions): Promise<Stats | BigIntStats> {
    return this.#baseFs.fstatPromise(this.fd, opts);
  }

  // FIXME: Missing FakeFS version
  truncate(len?: number): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  utimes(atime: string | number | Date, mtime: string | number | Date): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  writeFile(
    data: string | Uint8Array,
    options?: (ObjectEncodingOptions & FlagAndOpenMode & Abortable) | BufferEncoding | null,
  ): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  write(
    buffer: Buffer,
    offset?: number | null,
    length?: number | null,
    position?: number | null
  ): Promise<{ bytesWritten: number, buffer: Buffer }>;
  write(
    data: string,
    position?: number | null,
    encoding?: BufferEncoding | null,
  ): Promise<{ bytesWritten: number, buffer: string }> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  writev(buffers: ReadonlyArray<NodeJS.ArrayBufferView>, position?: number): Promise<WriteVResult> {
    throw new Error(`Method not implemented.`);
  }

  // FIXME: Missing FakeFS version
  readv(buffers: ReadonlyArray<NodeJS.ArrayBufferView>, position?: number): Promise<ReadVResult> {
    throw new Error(`Method not implemented.`);
  }

  #closePromise: Promise<void> | null = null;
  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;

    this.#closePromise = this.#baseFs.closePromise(this.fd);
    this.fd = -1;
    return this.#closePromise;
  }
}
