import {MessageName} from './MessageName';
import {Report}      from './Report';
import {Locator}     from './types';

export class ThrowReport extends Report {
  reportCacheHit(locator: Locator) {
  }

  reportCacheMiss(locator: Locator) {
  }

  startTimerSync<T>(what: string, cb: () => T) {
    return cb();
  }

  async startTimerPromise<T>(what: string, cb: () => Promise<T>) {
    return await cb();
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
