import EventEmitter = require('eventemitter3');

import {Writable}                   from 'stream';
import {WriteStream as WritableTTY} from 'tty';

export type OutputOptions = {
  isDebug: boolean,
  isInline: boolean,
};

export class TermOutput extends EventEmitter {
  public readonly isDebug: boolean;
  public readonly isInline: boolean;

  private readonly stdout: Writable | WritableTTY;

  private opened: boolean = false;

  private bufferData: string = ``;
  private bufferDepth: number = 0;

  constructor(stdout: Writable | WritableTTY, {isDebug = false, isInline = false}: Partial<OutputOptions> = {}) {
    super();

    this.stdout = stdout;

    this.isDebug = isDebug;
    this.isInline = isInline;
  }

  get columns() {
    if (this.stdout instanceof WritableTTY) {
      return this.stdout.columns;
    } else {
      return 80;
    }
  }

  get rows() {
    if (this.stdout instanceof WritableTTY) {
      return this.stdout.rows;
    } else {
      return 20;
    }
  }

  open() {
    if (this.opened)
      throw new Error(`Instance already open`);

    // @ts-ignore: `resize` is a valid event
    this.stdout.addListener(`resize`, this.handleResize);

    this.opened = true;
  }

  close() {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    // @ts-ignore: `resize` is a valid event
    this.stdout.removeListener(`resize`, this.handleResize);

    this.opened = false;
  }

  buffer(fn: () => void) {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    this.bufferDepth += 1;
    let result;

    try {
      result = fn();
    } finally {
      this.bufferDepth -= 1;
    }

    if (this.bufferDepth === 0) {
      // @ts-ignore What?
      this.stdout.write(this.bufferData);
      this.bufferData = ``;
    }

    return result;
  }

  writeMeta(data: any) {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    if (this.isDebug)
      return;

    if (this.bufferDepth > 0) {
      this.bufferData += String(data);
    } else {
      // @ts-ignore What?
      this.stdout.write(data);
    }
  }

  write(data: any) {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    if (this.isDebug)
      return;

    if (this.bufferDepth > 0) {
      this.bufferData += String(data);
    } else {
      // @ts-ignore What?
      this.stdout.write(data);
    }
  }

  writeDebug(data: any) {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    if (!this.isDebug)
      return;

    if (this.bufferDepth > 0) {
      this.bufferData += String(data);
    } else {
      // @ts-ignore What?
      this.stdout.write(data);
    }
  }

  handleResize = () => {
    this.emit(`resize`, {
      columns: this.columns,
      rows: this.rows,
    });
  }
}
