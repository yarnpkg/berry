import throttle        from 'lodash/throttle';
import {PassThrough}   from 'stream';
import {StringDecoder} from 'string_decoder';

import {MessageName}   from './MessageName';
import {Locator}       from './types';

const TITLE_PROGRESS_FPS = 15;

export class ReportError extends Error {
  public reportCode: MessageName;
  public originalError?: Error;

  constructor(code: MessageName, message: string, public reportExtra?: (report: Report) => void) {
    super(message);

    this.reportCode = code;
  }
}

export function isReportError(error: Error): error is ReportError {
  return typeof (error as ReportError).reportCode !== `undefined`;
}

export type ProgressDefinition = {
  progress?: number;
  title?: string;
};

export type ProgressIterable = AsyncIterable<ProgressDefinition> & {
  hasProgress: boolean;
  hasTitle: boolean;
};

export type SectionOptions = {
  reportHeader?: () => void;
  reportFooter?: (elapsedTime: number) => void;
  skipIfEmpty?: boolean;
};

export type TimerOptions = Pick<SectionOptions, 'skipIfEmpty'>;

export abstract class Report {
  private reportedInfos: Set<any> = new Set();
  private reportedWarnings: Set<any> = new Set();
  private reportedErrors: Set<any> = new Set();

  abstract reportCacheHit(locator: Locator): void;
  abstract reportCacheMiss(locator: Locator, message?: string): void;

  abstract startSectionPromise<T>(opts: SectionOptions, cb: () => Promise<T>): Promise<T>;
  abstract startSectionSync<T>(opts: SectionOptions, cb: () => T): T;

  abstract startTimerPromise<T>(what: string, opts: TimerOptions, cb: () => Promise<T>): Promise<T>;
  abstract startTimerPromise<T>(what: string, cb: () => Promise<T>): Promise<T>;

  abstract startTimerSync<T>(what: string, opts: TimerOptions, cb: () => T): T;
  abstract startTimerSync<T>(what: string, cb: () => T): T;

  abstract startCacheReport<T>(cb: () => Promise<T>): Promise<T>;

  abstract reportSeparator(): void;
  abstract reportInfo(name: MessageName | null, text: string): void;
  abstract reportWarning(name: MessageName, text: string): void;
  abstract reportError(name: MessageName, text: string): void;
  abstract reportProgress(progress: AsyncIterable<ProgressDefinition>): Promise<void> & {stop: () => void};
  abstract reportJson(data: any): void;

  abstract finalize(): void;

  static progressViaCounter(max: number) {
    let current = 0;

    let unlock: () => void;
    let lock = new Promise<void>(resolve => {
      unlock = resolve;
    });

    const set = (n: number) => {
      const thisUnlock = unlock;

      lock = new Promise<void>(resolve => {
        unlock = resolve;
      });

      current = n;
      thisUnlock();
    };

    const tick = (n: number = 0) => {
      set(current + 1);
    };

    const gen = (async function * () {
      while (current < max) {
        await lock;
        yield {
          progress: current / max,
        };
      }
    })();

    return {
      [Symbol.asyncIterator]() {
        return gen;
      },
      hasProgress: true,
      hasTitle: false,
      set,
      tick,
    };
  }

  static progressViaTitle() {
    let currentTitle: string | undefined;

    let unlock: () => void;
    let lock = new Promise<void>(resolve => {
      unlock = resolve;
    });

    const setTitle = throttle((title: string) => {
      const thisUnlock = unlock;

      lock = new Promise<void>(resolve => {
        unlock = resolve;
      });

      currentTitle = title;
      thisUnlock();
    }, 1000 / TITLE_PROGRESS_FPS);

    const gen = (async function * () {
      while (true) {
        await lock;
        yield {
          title: currentTitle,
        };
      }
    })();

    return {
      [Symbol.asyncIterator]() {
        return gen;
      },
      hasProgress: false,
      hasTitle: true,
      setTitle,
    };
  }

  async startProgressPromise<T, P extends ProgressIterable>(progressIt: P, cb: (progressIt: P) => Promise<T>): Promise<T> {
    const reportedProgress = this.reportProgress(progressIt);

    try {
      return await cb(progressIt);
    } finally {
      reportedProgress.stop();
    }
  }

  startProgressSync<T, P extends ProgressIterable>(progressIt: P, cb: (progressIt: P) => T): T {
    const reportedProgress = this.reportProgress(progressIt);

    try {
      return cb(progressIt);
    } finally {
      reportedProgress.stop();
    }
  }

  reportInfoOnce(name: MessageName, text: string, opts?: {key?: any, reportExtra?: (report: Report) => void}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedInfos.has(key)) {
      this.reportedInfos.add(key);
      this.reportInfo(name, text);

      opts?.reportExtra?.(this);
    }
  }

  reportWarningOnce(name: MessageName, text: string, opts?: {key?: any, reportExtra?: (report: Report) => void}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedWarnings.has(key)) {
      this.reportedWarnings.add(key);
      this.reportWarning(name, text);

      opts?.reportExtra?.(this);
    }
  }

  reportErrorOnce(name: MessageName, text: string, opts?: {key?: any, reportExtra?: (report: Report) => void}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedErrors.has(key)) {
      this.reportedErrors.add(key);
      this.reportError(name, text);

      opts?.reportExtra?.(this);
    }
  }

  reportExceptionOnce(error: Error | ReportError) {
    if (isReportError(error)) {
      this.reportErrorOnce(error.reportCode, error.message, {key: error, reportExtra: error.reportExtra});
    } else {
      this.reportErrorOnce(MessageName.EXCEPTION, error.stack || error.message, {key: error});
    }
  }

  createStreamReporter(prefix: string | null = null) {
    const stream = new PassThrough();
    const decoder = new StringDecoder();

    let buffer = ``;

    stream.on(`data`, chunk => {
      let chunkStr = decoder.write(chunk);
      let lineIndex;

      do {
        lineIndex = chunkStr.indexOf(`\n`);

        if (lineIndex !== -1) {
          const line = buffer + chunkStr.substr(0, lineIndex);

          chunkStr = chunkStr.substr(lineIndex + 1);
          buffer = ``;

          if (prefix !== null) {
            this.reportInfo(null, `${prefix} ${line}`);
          } else {
            this.reportInfo(null, line);
          }
        }
      } while (lineIndex !== -1);

      buffer += chunkStr;
    });

    stream.on(`end`, () => {
      const last = decoder.end();

      if (last !== ``) {
        if (prefix !== null) {
          this.reportInfo(null, `${prefix} ${last}`);
        } else {
          this.reportInfo(null, last);
        }
      }
    });

    return stream;
  }
}
