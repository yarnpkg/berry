// @ts-ignore
import {Key, Mouse, parseTerminalInputs}   from '@manaflair/term-strings/parse';
import EventEmitter                        from 'eventemitter3';
import {Readable}                          from 'stream';
import {ReadStream as ReadableTTY}         from 'tty';

export class TermInput extends EventEmitter {
  private readonly stdin: Readable | ReadableTTY;

  private opened: boolean = false;

  private subscription: any | null = null;

  constructor(stdin: Readable | ReadableTTY) {
    super();

    this.stdin = stdin;
  }

  open() {
    if (this.opened)
      throw new Error(`Instance already opened`);

    this.subscription = parseTerminalInputs(this.stdin, {
      throttleMouseMoveEvents: 1000 / 60,
    }).subscribe({
      next: (input: any) => {
        if (input instanceof Key) {
          this.emit(`key`, {key: input});
        } else if (input instanceof Mouse) {
          this.emit(`mouse`, {mouse: input});
        } else {
          this.emit(`data`, {buffer: input});
        }
      },
    });

    this.opened = true;
  }

  close() {
    if (!this.opened)
      throw new Error(`Instance isn't open`);

    this.subscription.unsubscribe();
    this.subscription = null;

    this.opened = false;
  }

  setRawMode(mode: boolean) {
    if (!this.subscription)
      throw new Error(`Instance isn't open`);

    if (this.stdin instanceof ReadableTTY) {
      this.stdin.setRawMode(mode);
    }
  }
}
