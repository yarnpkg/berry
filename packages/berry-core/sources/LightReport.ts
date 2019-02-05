import {Writable}            from 'stream';

import {Configuration}       from './Configuration';
import {Report, MessageName} from './Report';
import {Locator}             from './types';

export type LightReportOptions = {
  configuration: Configuration,
  stdout: Writable,
};

export class LightReport extends Report {
  static async start(opts: LightReportOptions, cb: (report: LightReport) => Promise<void>) {
    const report = new this(opts);

    try {
      await cb(report);
    } catch (error) {
      report.reportExceptionOnce(error);
    } finally {
      await report.finalize();
    }

    return report;
  }

  private configuration: Configuration;
  private stdout: Writable;

  private errorCount: number = 0;

  constructor({configuration, stdout}: LightReportOptions) {
    super();

    this.configuration = configuration;
    this.stdout = stdout;
  }

  hasErrors() {
    return this.errorCount > 0;
  }

  exitCode() {
    return this.hasErrors() ? 1 : 0;
  }

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

  reportInfo(name: MessageName, text: string) {
  }

  reportWarning(name: MessageName, text: string) {
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;
    this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} ${this.formatName(name)}: ${text}\n`);
  }

  async finalize() {
    if (this.errorCount > 0) {
      this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} Errors happened when preparing the environment required to run this command.\n`);
      this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} This might be caused by packages being missing from the lockfile, in which case running "berry install" might help.\n`);
    }
  }

  private formatName(name: MessageName) {
    return `BR` + name.toString(10).padStart(4, `0`);
  }
}
