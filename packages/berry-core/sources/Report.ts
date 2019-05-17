import {PassThrough}   from 'stream';
import {StringDecoder} from 'string_decoder';

import {Locator}       from './types';

// The values in this enum should never be reassigned, even if some are removed
// over time (it would mess up the search results, which are the whole point of
// having this system)
export enum MessageName {
  UNNAMED = 0,
  EXCEPTION = 1,
  MISSING_PEER_DEPENDENCY = 2,
  CYCLIC_DEPENDENCIES = 3,
  DISABLED_BUILD_SCRIPTS = 4,
  BUILD_DISABLED = 5,
  SOFT_LINK_BUILD = 6,
  MUST_BUILD = 7,
  MUST_REBUILD = 8,
  BUILD_FAILED = 9,
  RESOLVER_NOT_FOUND = 10,
  FETCHER_NOT_FOUND = 11,
  LINKER_NOT_FOUND = 12,
  FETCH_NOT_CACHED = 13,
  YARN_IMPORT_FAILED = 14,
  REMOTE_INVALID = 15,
  REMOTE_NOT_FOUND = 16,
  RESOLUTION_PACK = 17,
  CACHE_CHECKSUM_MISMATCH = 18,
  UNUSED_CACHE_ENTRY = 19,
  MISSING_LOCKFILE_ENTRY = 20,
  WORKSPACE_NOT_FOUND = 21,
  TOO_MANY_MATCHING_WORKSPACES = 22,
  CONSTRAINTS_MISSING_DEPENDENCY = 23,
  CONSTRAINTS_INCOMPATIBLE_DEPENDENCY = 24,
  CONSTRAINTS_EXTRANEOUS_DEPENDENCY = 25,
  CONSTRAINTS_INVALID_DEPENDENCY = 26,
  CANT_SUGGEST_RESOLUTIONS = 27,
  FROZEN_LOCKFILE_EXCEPTION = 28,
  CROSS_DRIVE_VIRTUAL_LOCAL = 29,
  FETCH_FAILED = 30,
  DANGEROUS_NODE_MODULES = 31,
  NODE_GYP_INJECTED = 32,
  AUTHENTICATION_NOT_FOUND = 33,
  INVALID_CONFIGURATION_KEY = 34,
  NETWORK_ERROR = 35,
  LIFECYCLE_SCRIPT = 36,
  CONSTRAINTS_MISSING_FIELD = 37,
  CONSTRAINTS_INCOMPATIBLE_FIELD = 38,
  CONSTRAINTS_EXTRANEOUS_FIELD = 39,
  CONSTRAINTS_INVALID_FIELD = 40,
  AUTHENTICATION_INVALID = 41,
  PROLOG_UNKNOWN_ERROR = 42,
  PROLOG_SYNTAX_ERROR = 43,
  PROLOG_EXISTENCE_ERROR = 44,
}

export class ReportError extends Error {
  public reportCode: MessageName;

  constructor(code: MessageName, message: string) {
    super(message);

    this.reportCode = code;
  }
}

export function isReportError(error: Error): error is ReportError {
  return typeof (error as ReportError).reportCode !== `undefined`;
}

export abstract class Report {
  private reportedInfos: Set<any> = new Set();
  private reportedWarnings: Set<any> = new Set();
  private reportedErrors: Set<any> = new Set();

  abstract reportCacheHit(locator: Locator): void;
  abstract reportCacheMiss(locator: Locator): void;

  abstract startTimerPromise<T>(what: string, cb: () => Promise<T>): Promise<T>;
  abstract startTimerSync<T>(what: string, cb: () => T): T;

  abstract reportSeparator(): void;
  abstract reportInfo(name: MessageName | null, text: string): void;
  abstract reportWarning(name: MessageName, text: string): void;
  abstract reportError(name: MessageName, text: string): void;
  abstract reportJson(data: any): void;

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

  reportExceptionOnce(error: Error | ReportError) {
    if (isReportError(error)) {
      this.reportErrorOnce(error.reportCode, error.message, {key: error});
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
