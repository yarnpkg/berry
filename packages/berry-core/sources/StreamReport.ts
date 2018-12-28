import {Writable}            from 'stream';

import {Report, MessageName} from './Report';
import {Locator}             from './types';

export type StreamReportOptions = {
  stdout: Writable,
};

export class StreamReport extends Report {
  static async start(opts: StreamReportOptions, cb: (report: StreamReport) => Promise<void>) {
    const report = new this(opts);

    try {
      await cb(report);
    } catch (error) {
      report.reportError(MessageName.EXCEPTION, error.message);
    } finally {
      await report.finalize();
    }

    return report;
  }

  private stdout: Writable;

  private cacheHitCount: number = 0;
  private cacheMissCount: number = 0;

  private warningCount: number = 0;
  private errorCount: number = 0;

  private startTime: number = Date.now();

  private indent: number = 0;

  constructor({stdout}: StreamReportOptions) {
    super();

    this.stdout = stdout;
  }

  hasErrors() {
    return this.errorCount > 0;
  }

  reportCacheHit(locator: Locator) {
    this.cacheHitCount += 1;
  }

  reportCacheMiss(locator: Locator) {
    this.cacheMissCount += 1;
  }

  startTimerSync<T>(what: string, cb: () => T) {
    this.reportInfo(MessageName.UNNAMED, `Starting ${what}`);

    this.indent += 1;

    const before = Date.now();
    const res = cb();
    const after = Date.now();

    this.indent -= 1;

    this.reportInfo(MessageName.UNNAMED, `Completing ${what} (after ${this.formatTiming(after - before)})`);

    return res;
  }

  async startTimerPromise<T>(what: string, cb: () => Promise<T>) {
    this.reportInfo(MessageName.UNNAMED, `Starting ${what}`);

    this.indent += 1;

    const before = Date.now();
    const res = await cb();
    const after = Date.now();

    this.indent -= 1;

    this.reportInfo(MessageName.UNNAMED, `Completing ${what} (after ${this.formatTiming(after - before)})`);

    return res;
  }

  reportInfo(name: MessageName, text: string) {
    this.stdout.write(`${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
  }

  reportWarning(name: MessageName, text: string) {
    this.warningCount += 1;
    this.stdout.write(`${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;
    this.stdout.write(`${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
  }

  async finalize() {
    let fetchStatus = ``;

    if (this.cacheHitCount > 1) {
      fetchStatus += ` - ${this.cacheHitCount} packages were already cached`;
    } else if (this.cacheHitCount === 1) {
      fetchStatus += ` - one package was already cached`;
    }

    if (this.cacheHitCount > 0) {
      if (this.cacheMissCount > 1) {
        fetchStatus += `, ${this.cacheMissCount} had to be fetched`;
      } else if (this.cacheMissCount === 1) {
        fetchStatus += `, one had to be fetched`;
      }
    } else {
      if (this.cacheMissCount > 1) {
        fetchStatus += ` - ${this.cacheMissCount} packages had to be fetched`;
      } else if (this.cacheMissCount === 1) {
        fetchStatus += ` - one package had to be fetched`;
      }
    }

    const withErrors = this.errorCount > 0
      ? ` with errors`
      : this.warningCount > 0
        ? ` with warnings`
        : ``;
      
    const timing = this.formatTiming(Date.now() - this.startTime);

    this.reportInfo(MessageName.UNNAMED, `Done${withErrors} in ${timing}${fetchStatus}.`);
  }

  private formatTiming(timing: number) {
    return timing < 60 * 1000
      ? `${Math.round(timing / 10) / 100}s`
      : `${Math.round(timing / 600) / 100}m`;
  }

  private formatName(name: MessageName) {
    return `BR` + name.toString(10).padStart(4, `0`);
  }

  private formatIndent() {
    return `  `.repeat(this.indent);
  }
}
