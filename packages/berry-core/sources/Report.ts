import {Locator} from './types';

// The values in this enum should never be reassigned, even if some are removed
// over time (it would mess up the search results, which are the whole point of
// having this system)
export enum MessageName {
  UNNAMED = 0,
  EXCEPTION = 1,
  MISSING_PEER_DEPENDENCY = 2,
  CYCLIC_DEPENDENCIES = 3,
  DISABLED_BUILD_SCRIPTS = 4,
  SOFT_LINK_BUILD = 5,
}

export abstract class Report {
  private reportedInfos: Set<any> = new Set();
  private reportedWarnings: Set<any> = new Set();
  private reportedErrors: Set<any> = new Set();

  abstract reportCacheHit(locator: Locator): void;
  abstract reportCacheMiss(locator: Locator): void;

  abstract startTimerPromise<T>(what: string, cb: () => Promise<T>): Promise<T>;
  abstract startTimerSync<T>(what: string, cb: () => T): T;

  abstract reportInfo(name: MessageName, text: string): void;
  abstract reportWarning(name: MessageName, text: string): void;
  abstract reportError(name: MessageName, text: string): void;

  abstract finalize(): void;

  reportInfoOnce(name: MessageName, text: string, opts?: {key?: any}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedInfos.has(key)) {
      this.reportedInfos.add(key);
      this.reportInfo(name, text);
    }
  }

  reportWarningOnce(name: MessageName, text: string, opts?: {key?: any}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedWarnings.has(key)) {
      this.reportedWarnings.add(key);
      this.reportWarning(name, text);
    }
  }

  reportErrorOnce(name: MessageName, text: string, opts?: {key?: any}) {
    const key = opts && opts.key ? opts.key : text;

    if (!this.reportedErrors.has(key)) {
      this.reportedErrors.add(key);
      this.reportError(name, text);
    }
  }
}
