import {Report, MessageName} from './Report';
import {Locator}             from './types';

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

  reportSeparator() {
  }

  reportInfo(name: MessageName | null, text: string) {
  }

  reportWarning(name: MessageName, text: string) {
  }

  reportError(name: MessageName, text: string) {
  }

  reportJson(data: any) {
    // Just ignore the json output
  }

  async finalize() {
  }
}
