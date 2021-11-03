import {Writable}                             from 'stream';

import {Configuration}                        from './Configuration';
import {MessageName}                          from './MessageName';
import {Report, SectionOptions, TimerOptions} from './Report';
import {formatNameWithHyperlink}              from './StreamReport';
import * as formatUtils                       from './formatUtils';
import {Locator}                              from './types';

export type LightReportOptions = {
  configuration: Configuration;
  stdout: Writable;
  suggestInstall?: boolean;
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

    formatUtils.addLogFilterSupport(this, {configuration});

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
    this.errorCount += 1;
    this.stdout.write(`${formatUtils.pretty(this.configuration, `➤`, `redBright`)} ${this.formatNameWithHyperlink(name)}: ${text}\n`);
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
      this.stdout.write(`\n`);
      this.stdout.write(`${formatUtils.pretty(this.configuration, `➤`, `redBright`)} Errors happened when preparing the environment required to run this command.\n`);

      if (this.suggestInstall) {
        this.stdout.write(`${formatUtils.pretty(this.configuration, `➤`, `redBright`)} This might be caused by packages being missing from the lockfile, in which case running "yarn install" might help.\n`);
      }
    }
  }

  private formatNameWithHyperlink(name: MessageName | null) {
    return formatNameWithHyperlink(name, {
      configuration: this.configuration,
      json: false,
    });
  }
}
