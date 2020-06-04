import {Writable}      from 'stream';

import {Configuration} from './Configuration';
import {MessageName}   from './MessageName';
import {Report}        from './Report';
import {Locator}       from './types';

export type LightReportOptions = {
  configuration: Configuration,
  stdout: Writable,
  suggestInstall?: boolean,
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
  private suggestInstall: boolean;

  private errorCount: number = 0;

  constructor({configuration, stdout, suggestInstall = true}: LightReportOptions) {
    super();

    this.configuration = configuration;
    this.stdout = stdout;
    this.suggestInstall = suggestInstall;
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
    this.errorCount += 1;
    this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} ${this.formatName(name)}: ${text}\n`);
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
    if (this.errorCount > 0) {
      this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} Errors happened when preparing the environment required to run this command.\n`);

      if (this.suggestInstall) {
        this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} This might be caused by packages being missing from the lockfile, in which case running "yarn install" might help.\n`);
      }
    }
  }

  private formatName(name: MessageName) {
    return `BR${name.toString(10).padStart(4, `0`)}`;
  }
}
