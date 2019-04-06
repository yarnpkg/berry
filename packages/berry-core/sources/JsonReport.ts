import {Writable}            from 'stream';

import {Configuration}       from './Configuration';
import {Report, MessageName} from './Report';
import {Locator}             from './types';

export type JsonReportOptions = {
  stdout: Writable,
};

export class JsonReport extends Report {
  private stdout: Writable;

  private errorCount: number = 0;

  static async start(opts: JsonReportOptions, cb: (report: JsonReport) => Promise<void>) {
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

  static send(opts: JsonReportOptions, data: any) {
    const report = new this(opts);

    report.reportJson(data);
    report.finalize();

    return report;
  }

  constructor({stdout}: JsonReportOptions) {
    super();

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
    this.stdout.write(`${JSON.stringify({$message: {type: `info`, name, text}})}\n`);
  }

  reportWarning(name: MessageName, text: string) {
    this.stdout.write(`${JSON.stringify({$message: {type: `warning`, name, text}})}\n`);
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;
    this.stdout.write(`${JSON.stringify({$message: {type: `error`, name, text}})}\n`);
  }

  reportJson(data: any) {
    this.stdout.write(`${JSON.stringify(data)}\n`);
  }

  async finalize() {
  }
}
