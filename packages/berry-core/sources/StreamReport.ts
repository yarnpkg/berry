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
      report.reportErrorOnce(MessageName.EXCEPTION, error.message, {key: error});
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

    const before = Date.now();
    this.indent += 1;

    try {
      return cb();
    } catch (error) {
      this.reportErrorOnce(MessageName.EXCEPTION, error.message, {key: error});
      throw error;
    } finally {
      const after = Date.now();
      this.indent -= 1;

      this.reportInfo(MessageName.UNNAMED, `Completing ${what} (after ${this.formatTiming(after - before)})`);
    }
  }

  async startTimerPromise<T>(what: string, cb: () => Promise<T>) {
    this.reportInfo(MessageName.UNNAMED, `Starting ${what}`);

    const before = Date.now();
    this.indent += 1;

    try {
      return await cb();
    } catch (error) {
      this.reportErrorOnce(MessageName.EXCEPTION, error.message, {key: error});
      throw error;
    } finally {
      const after = Date.now();
      this.indent -= 1;

      this.reportInfo(MessageName.UNNAMED, `Completing ${what} (after ${this.formatTiming(after - before)})`);
    }
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
    let installStatus = ``;

    if (this.errorCount > 0) {
      installStatus = `Failed with errors`;
    } else if (this.warningCount > 0) {
      installStatus = `Done with warnings`;
    } else {
      installStatus = `Done`;
    }

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

    const timing = this.formatTiming(Date.now() - this.startTime);

    this.reportInfo(MessageName.UNNAMED, `${installStatus} in ${timing}${fetchStatus}`);
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
