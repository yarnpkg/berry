import {Writable}            from 'stream';

import {Configuration}       from './Configuration';
import {Report, MessageName} from './Report';
import {Locator}             from './types';

export type StreamReportOptions = {
  configuration: Configuration,
  footer?: boolean,
  json?: boolean,
  stdout: Writable,
};

export class StreamReport extends Report {
  static async start(opts: StreamReportOptions, cb: (report: StreamReport) => Promise<void>) {
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
  private footer: boolean;
  private json: boolean;  
  private stdout: Writable;

  private cacheHitCount: number = 0;
  private cacheMissCount: number = 0;

  private warningCount: number = 0;
  private errorCount: number = 0;

  private startTime: number = Date.now();

  private indent: number = 0;

  constructor({configuration, stdout, footer = true, json = false}: StreamReportOptions) {
    super();

    this.configuration = configuration;
    this.footer = footer;
    this.json = json;
    this.stdout = stdout;
  }

  hasErrors() {
    return this.errorCount > 0;
  }

  exitCode() {
    return this.hasErrors() ? 1 : 0;
  }

  reportCacheHit(locator: Locator) {
    this.cacheHitCount += 1;
  }

  reportCacheMiss(locator: Locator) {
    this.cacheMissCount += 1;
  }

  startTimerSync<T>(what: string, cb: () => T) {
    this.reportInfo(null, `┌ ${what}`);

    const before = Date.now();
    this.indent += 1;

    try {
      return cb();
    } catch (error) {
      this.reportExceptionOnce(error);
      throw error;
    } finally {
      const after = Date.now();
      this.indent -= 1;

      if (this.configuration.get(`enableTimers`)) {
        this.reportInfo(null, `└ Completed in ${this.formatTiming(after - before)}`);
      } else {
        this.reportInfo(null, `└ Completed`);
      }
    }
  }

  async startTimerPromise<T>(what: string, cb: () => Promise<T>) {
    this.reportInfo(null, `┌ ${what}`);

    const before = Date.now();
    this.indent += 1;

    try {
      return await cb();
    } catch (error) {
      this.reportExceptionOnce(error);
      throw error;
    } finally {
      const after = Date.now();
      this.indent -= 1;

      if (this.configuration.get(`enableTimers`)) {
        this.reportInfo(null, `└ Completed in ${this.formatTiming(after - before)}`);
      } else {
        this.reportInfo(null, `└ Completed`);
      }
    }
  }

  reportSeparator() {
    if (this.indent === 0) {
      this.stdout.write(`\n`);
    } else {
      this.reportInfo(null, ``);
    }
  }

  reportInfo(name: MessageName | null, text: string) {
    if (!this.json) {
      this.stdout.write(`${this.configuration.format(`➤`, `blueBright`)} ${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
    }
  }

  reportWarning(name: MessageName, text: string) {
    this.warningCount += 1;

    if (!this.json) {
      this.stdout.write(`${this.configuration.format(`➤`, `yellowBright`)} ${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
    }
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;

    this.stdout.write(`${this.configuration.format(`➤`, `redBright`)} ${this.formatName(name)}: ${this.formatIndent()}${text}\n`);
  }

  reportJson(data: any) {
    if (this.json) {
      this.stdout.write(`${JSON.stringify(data)}\n`);
    }
  }

  async finalize() {
    if (!this.footer)
      return;

    let installStatus = ``;

    if (this.errorCount > 0)
      installStatus = `Failed with errors`;
    else if (this.warningCount > 0)
      installStatus = `Done with warnings`;
    else
      installStatus = `Done`;

    let fetchStatus = ``;

    if (this.cacheHitCount > 1)
      fetchStatus += ` - ${this.cacheHitCount} packages were already cached`;
    else if (this.cacheHitCount === 1)
      fetchStatus += ` - one package was already cached`;

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
    const message = this.configuration.get(`enableTimers`)
      ? `${installStatus} in ${timing}${fetchStatus}`
      : installStatus;

    if (this.errorCount > 0) {
      this.reportError(MessageName.UNNAMED, message);
    } else if (this.warningCount > 0) {
      this.reportWarning(MessageName.UNNAMED, message);
    } else {
      this.reportInfo(MessageName.UNNAMED, message);
    }
  }

  private formatTiming(timing: number) {
    return timing < 60 * 1000
      ? `${Math.round(timing / 10) / 100}s`
      : `${Math.round(timing / 600) / 100}m`;
  }

  private formatName(name: MessageName | null) {
    const num = name === null ? 0 : name;
    const label = `YN` + num.toString(10).padStart(4, `0`);

    if (name === null) {
      return this.configuration.format(label, `grey`);
    } else {
      return label;
    }
  }

  private formatIndent() {
    return `│ `.repeat(this.indent);
  }
}
