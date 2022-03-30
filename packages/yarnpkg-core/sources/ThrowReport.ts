import {MessageName}                          from './MessageName';
import {Report, SectionOptions, TimerOptions} from './Report';
import {Locator}                              from './types';

export class ThrowReport extends Report {
  reportCacheHit(locator: Locator) {
  }

  reportCacheMiss(locator: Locator) {
  }

  startSectionSync<T>(opts: SectionOptions, cb: () => T) {
    return cb();
  }

  async startSectionPromise<T>(opts: SectionOptions, cb: () => Promise<T>) {
    return await cb();
  }

  startTimerSync<T>(what: string, opts: TimerOptions, cb: () => T): T;
  startTimerSync<T>(what: string, cb: () => T): T;
  startTimerSync<T>(what: string, opts: TimerOptions | (() => T), cb?: () => T) {
    const realCb = typeof opts === `function` ? opts : cb!;
    return realCb();
  }

  async startTimerPromise<T>(what: string, opts: TimerOptions, cb: () => Promise<T>): Promise<T>;
  async startTimerPromise<T>(what: string, cb: () => Promise<T>): Promise<T>;
  async startTimerPromise<T>(what: string, opts: TimerOptions | (() => Promise<T>), cb?: () => Promise<T>) {
    const realCb = typeof opts === `function` ? opts : cb!;
    return await realCb();
  }

  async startCacheReport<T>(cb: () => Promise<T>) {
    return await cb();
  }

  reportSeparator() {
  }

  reportInfo(name: MessageName | null, text: string) {
  }

  reportWarning(name: MessageName, text: string) {
  }

  reportError(name: MessageName, text: string) {
  }

  reportProgress(progress: AsyncIterable<{progress: number, title?: string}>) {
    const promise = Promise.resolve().then(async () => {
      // eslint-disable-next-line no-empty-pattern
      for await (const {} of progress) {
        // No need to do anything; we just want to consume the progress events
      }
    });

    const stop = () => {
      // Nothing to stop
    };

    return {...promise, stop};
  }

  reportJson(data: any) {
    // Just ignore the json output
  }

  async finalize() {
  }
}
