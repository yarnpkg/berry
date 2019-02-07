import {Writable}            from 'stream';

import {Configuration}       from './Configuration';
import {Report, MessageName} from './Report';
import {Locator}             from './types';

export type JsonReportOptions = {
  stdout: Writable,
};

export class JsonReport extends Report {
  private stdout: Writable;

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
  }

  reportJson(data: any) {
    this.stdout.write(`${JSON.stringify(data, null, `  `)}\n`);
  }

  async finalize() {
  }
}
