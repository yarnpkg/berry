import sliceAnsi                                                                    from '@arcanis/slice-ansi';
import CI                                                                           from 'ci-info';
import {Writable}                                                                   from 'stream';
import {WriteStream}                                                                from 'tty';

import {Configuration}                                                              from './Configuration';
import {MessageName, stringifyMessageName}                                          from './MessageName';
import {ProgressDefinition, Report, SectionOptions, TimerOptions, ProgressIterable} from './Report';
import * as formatUtils                                                             from './formatUtils';
import * as structUtils                                                             from './structUtils';
import {Locator}                                                                    from './types';

export type StreamReportOptions = {
  configuration: Configuration;
  forgettableBufferSize?: number;
  forgettableNames?: Set<MessageName | null>;
  includeFooter?: boolean;
  includeInfos?: boolean;
  includeLogs?: boolean;
  includeWarnings?: boolean;
  json?: boolean;
  stdout: Writable;
};

const PROGRESS_FRAMES = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`];
const PROGRESS_INTERVAL = 80;

const BASE_FORGETTABLE_NAMES = new Set<MessageName | null>([MessageName.FETCH_NOT_CACHED, MessageName.UNUSED_CACHE_ENTRY]);
const BASE_FORGETTABLE_BUFFER_SIZE = 5;

const GROUP = CI.GITHUB_ACTIONS
  ? {start: (what: string) => `::group::${what}\n`, end: (what: string) => `::endgroup::\n`}
  : CI.TRAVIS
    ? {start: (what: string) => `travis_fold:start:${what}\n`, end: (what: string) => `travis_fold:end:${what}\n`}
    : CI.GITLAB
      ? {start: (what: string) => `section_start:${Math.floor(Date.now() / 1000)}:${what.toLowerCase().replace(/\W+/g, `_`)}[collapsed=true]\r\x1b[0K${what}\n`, end: (what: string) => `section_end:${Math.floor(Date.now() / 1000)}:${what.toLowerCase().replace(/\W+/g, `_`)}\r\x1b[0K`}
      : null;

const now = new Date();

// We only want to support environments that will out-of-the-box accept the
// characters we want to use. Others can enforce the style from the project
// configuration.
const supportsEmojis = [`iTerm.app`, `Apple_Terminal`].includes(process.env.TERM_PROGRAM!) || !!process.env.WT_SESSION;

const makeRecord = <T>(obj: {[key: string]: T}) => obj;
const PROGRESS_STYLES = makeRecord({
  patrick: {
    date: [17, 3],
    chars: [`🍀`, `🌱`],
    size: 40,
  },
  simba: {
    date: [19, 7],
    chars: [`🦁`, `🌴`],
    size: 40,
  },
  jack: {
    date: [31, 10],
    chars: [`🎃`, `🦇`],
    size: 40,
  },
  hogsfather: {
    date: [31, 12],
    chars: [`🎉`, `🎄`],
    size: 40,
  },
  default: {
    chars: [`=`, `-`],
    size: 80,
  },
});

const defaultStyle = (supportsEmojis && Object.keys(PROGRESS_STYLES).find(name => {
  const style = PROGRESS_STYLES[name];

  if (style.date && (style.date[0] !== now.getDate() || style.date[1] !== now.getMonth() + 1))
    return false;

  return true;
})) || `default`;

export function formatName(name: MessageName | null, {configuration, json}: {configuration: Configuration, json: boolean}) {
  if (!configuration.get(`enableMessageNames`))
    return ``;

  const num = name === null ? 0 : name;
  const label = stringifyMessageName(num);

  if (!json && name === null) {
    return formatUtils.pretty(configuration, label, `grey`);
  } else {
    return label;
  }
}

export function formatNameWithHyperlink(name: MessageName | null, {configuration, json}: {configuration: Configuration, json: boolean}) {
  const code = formatName(name, {configuration, json});
  if (!code)
    return code;

  // Don't print hyperlinks for the generic messages
  if (name === null || name === MessageName.UNNAMED)
    return code;

  const desc = MessageName[name];
  const href = `https://yarnpkg.com/advanced/error-codes#${code}---${desc}`.toLowerCase();

  return formatUtils.applyHyperlink(configuration, code, href);
}

export class StreamReport extends Report {
  static async start(opts: StreamReportOptions, cb: (report: StreamReport) => Promise<void>) {
    const report = new this(opts);

    const emitWarning = process.emitWarning;
    process.emitWarning = (message, name) => {
      if (typeof message !== `string`) {
        const error = message;

        message = error.message;
        name = name ?? error.name;
      }

      const fullMessage = typeof name !== `undefined`
        ? `${name}: ${message}`
        : message;

      report.reportWarning(MessageName.UNNAMED, fullMessage);
    };

    try {
      await cb(report);
    } catch (error) {
      report.reportExceptionOnce(error);
    } finally {
      await report.finalize();
      process.emitWarning = emitWarning;
    }

    return report;
  }

  private configuration: Configuration;
  private includeFooter: boolean;
  private includeInfos: boolean;
  private includeWarnings: boolean;
  private json: boolean;
  private stdout: Writable;

  private uncommitted = new Set<{
    committed: boolean;
    action: () => void;
  }>();

  private cacheHitCount: number = 0;
  private cacheMissCount: number = 0;
  private lastCacheMiss: Locator | null = null;

  private warningCount: number = 0;
  private errorCount: number = 0;

  private startTime: number = Date.now();

  private indent: number = 0;

  private progress: Map<ProgressIterable, {
    definition: ProgressDefinition;
    lastScaledSize?: number;
    lastTitle?: string;
  }> = new Map();

  private progressTime: number = 0;
  private progressFrame: number = 0;
  private progressTimeout: ReturnType<typeof setTimeout> | null = null;
  private progressStyle: {date?: Array<number>, chars: Array<string>, size: number} | null = null;
  private progressMaxScaledSize: number | null = null;

  private forgettableBufferSize: number;
  private forgettableNames: Set<MessageName | null>;
  private forgettableLines: Array<string> = [];

  constructor({
    configuration,
    stdout,
    json = false,
    includeFooter = true,
    includeLogs = !json,
    includeInfos = includeLogs,
    includeWarnings = includeLogs,
    forgettableBufferSize = BASE_FORGETTABLE_BUFFER_SIZE,
    forgettableNames = new Set(),
  }: StreamReportOptions) {
    super();

    formatUtils.addLogFilterSupport(this, {configuration});

    this.configuration = configuration;
    this.forgettableBufferSize = forgettableBufferSize;
    this.forgettableNames = new Set([...forgettableNames, ...BASE_FORGETTABLE_NAMES]);
    this.includeFooter = includeFooter;
    this.includeInfos = includeInfos;
    this.includeWarnings = includeWarnings;
    this.json = json;
    this.stdout = stdout;

    // Setup progress
    if (configuration.get(`enableProgressBars`) && !json && (stdout as WriteStream).isTTY && (stdout as WriteStream).columns > 22) {
      const styleName = configuration.get(`progressBarStyle`) || defaultStyle;
      if (!Object.prototype.hasOwnProperty.call(PROGRESS_STYLES, styleName))
        throw new Error(`Assertion failed: Invalid progress bar style`);

      this.progressStyle = PROGRESS_STYLES[styleName];
      const PAD_LEFT = `➤ YN0000: ┌ `.length;

      const maxWidth = Math.max(0, Math.min((stdout as WriteStream).columns - PAD_LEFT, 80));
      this.progressMaxScaledSize = Math.floor(this.progressStyle.size * maxWidth / 80);
    }
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

  reportCacheMiss(locator: Locator, message?: string) {
    this.lastCacheMiss = locator;
    this.cacheMissCount += 1;

    if (typeof message !== `undefined` && !this.configuration.get(`preferAggregateCacheInfo`)) {
      this.reportInfo(MessageName.FETCH_NOT_CACHED, message);
    }
  }

  startSectionSync<T>({reportHeader, reportFooter, skipIfEmpty}: SectionOptions, cb: () => T) {
    const mark = {committed: false, action: () => {
      reportHeader?.();
    }};

    if (skipIfEmpty) {
      this.uncommitted.add(mark);
    } else {
      mark.action();
      mark.committed = true;
    }

    const before = Date.now();

    try {
      return cb();
    } catch (error) {
      this.reportExceptionOnce(error);
      throw error;
    } finally {
      const after = Date.now();

      this.uncommitted.delete(mark);
      if (mark.committed) {
        reportFooter?.(after - before);
      }
    }
  }

  async startSectionPromise<T>({reportHeader, reportFooter, skipIfEmpty}: SectionOptions, cb: () => Promise<T>) {
    const mark = {committed: false, action: () => {
      reportHeader?.();
    }};

    if (skipIfEmpty) {
      this.uncommitted.add(mark);
    } else {
      mark.action();
      mark.committed = true;
    }

    const before = Date.now();

    try {
      return await cb();
    } catch (error) {
      this.reportExceptionOnce(error);
      throw error;
    } finally {
      const after = Date.now();

      this.uncommitted.delete(mark);
      if (mark.committed) {
        reportFooter?.(after - before);
      }
    }
  }

  private startTimerImpl<Callback extends Function>(what: string, opts: TimerOptions | Callback, cb?: Callback) {
    const realOpts = typeof opts === `function` ? {} : opts;
    const realCb = typeof opts === `function` ? opts : cb!;

    return {
      cb: realCb,
      reportHeader: () => {
        this.reportInfo(null, `┌ ${what}`);
        this.indent += 1;

        if (GROUP !== null && !this.json && this.includeInfos) {
          this.stdout.write(GROUP.start(what));
        }
      },
      reportFooter: elapsedTime => {
        this.indent -= 1;

        if (GROUP !== null && !this.json && this.includeInfos)
          this.stdout.write(GROUP.end(what));

        if (this.configuration.get(`enableTimers`) && elapsedTime > 200) {
          this.reportInfo(null, `└ Completed in ${formatUtils.pretty(this.configuration, elapsedTime, formatUtils.Type.DURATION)}`);
        } else {
          this.reportInfo(null, `└ Completed`);
        }
      },
      skipIfEmpty: realOpts.skipIfEmpty,
    } as SectionOptions & {cb: Callback};
  }

  startTimerSync<T>(what: string, opts: TimerOptions, cb: () => T): T;
  startTimerSync<T>(what: string, cb: () => T): T;
  startTimerSync<T>(what: string, opts: TimerOptions | (() => T), cb?: () => T) {
    const {cb: realCb, ...sectionOps} = this.startTimerImpl(what, opts, cb);
    return this.startSectionSync(sectionOps, realCb);
  }

  async startTimerPromise<T>(what: string, opts: TimerOptions, cb: () => Promise<T>): Promise<T>;
  async startTimerPromise<T>(what: string, cb: () => Promise<T>): Promise<T>;
  async startTimerPromise<T>(what: string, opts: TimerOptions | (() => Promise<T>), cb?: () => Promise<T>) {
    const {cb: realCb, ...sectionOps} = this.startTimerImpl(what, opts, cb);
    return this.startSectionPromise(sectionOps, realCb);
  }

  async startCacheReport<T>(cb: () => Promise<T>) {
    const cacheInfo = this.configuration.get(`preferAggregateCacheInfo`)
      ? {cacheHitCount: this.cacheHitCount, cacheMissCount: this.cacheMissCount}
      : null;

    try {
      return await cb();
    } catch (error) {
      this.reportExceptionOnce(error);
      throw error;
    } finally {
      if (cacheInfo !== null) {
        this.reportCacheChanges(cacheInfo);
      }
    }
  }

  reportSeparator() {
    if (this.indent === 0) {
      this.writeLineWithForgettableReset(``);
    } else {
      this.reportInfo(null, ``);
    }
  }

  reportInfo(name: MessageName | null, text: string) {
    if (!this.includeInfos)
      return;

    this.commit();

    const formattedName = this.formatNameWithHyperlink(name);
    const prefix = formattedName ? `${formattedName}: ` : ``;

    const message = `${formatUtils.pretty(this.configuration, `➤`, `blueBright`)} ${prefix}${this.formatIndent()}${text}`;

    if (!this.json) {
      if (this.forgettableNames.has(name)) {
        this.forgettableLines.push(message);
        if (this.forgettableLines.length > this.forgettableBufferSize) {
          while (this.forgettableLines.length > this.forgettableBufferSize)
            this.forgettableLines.shift();

          this.writeLines(this.forgettableLines, {truncate: true});
        } else {
          this.writeLine(message, {truncate: true});
        }
      } else {
        this.writeLineWithForgettableReset(message);
      }
    } else {
      this.reportJson({type: `info`, name, displayName: this.formatName(name), indent: this.formatIndent(), data: text});
    }
  }

  reportWarning(name: MessageName, text: string) {
    this.warningCount += 1;

    if (!this.includeWarnings)
      return;

    this.commit();

    const formattedName = this.formatNameWithHyperlink(name);
    const prefix = formattedName ? `${formattedName}: ` : ``;

    if (!this.json) {
      this.writeLineWithForgettableReset(`${formatUtils.pretty(this.configuration, `➤`, `yellowBright`)} ${prefix}${this.formatIndent()}${text}`);
    } else {
      this.reportJson({type: `warning`, name, displayName: this.formatName(name), indent: this.formatIndent(), data: text});
    }
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;

    this.commit();

    const formattedName = this.formatNameWithHyperlink(name);
    const prefix = formattedName ? `${formattedName}: ` : ``;

    if (!this.json) {
      this.writeLineWithForgettableReset(`${formatUtils.pretty(this.configuration, `➤`, `redBright`)} ${prefix}${this.formatIndent()}${text}`, {truncate: false});
    } else {
      this.reportJson({type: `error`, name, displayName: this.formatName(name), indent: this.formatIndent(), data: text});
    }
  }

  reportProgress(progressIt: ProgressIterable) {
    if (this.progressStyle === null)
      return {...Promise.resolve(), stop: () => {}};

    if (progressIt.hasProgress && progressIt.hasTitle)
      throw new Error(`Unimplemented: Progress bars can't have both progress and titles.`);

    let stopped = false;

    const promise = Promise.resolve().then(async () => {
      const progressDefinition: ProgressDefinition = {
        progress: progressIt.hasProgress ? 0 : undefined,
        title: progressIt.hasTitle ? `` : undefined,
      };

      this.progress.set(progressIt, {
        definition: progressDefinition,
        lastScaledSize: progressIt.hasProgress ? -1 : undefined,
        lastTitle: undefined,
      });

      this.refreshProgress({delta: -1});

      for await (const {progress, title} of progressIt) {
        if (stopped)
          continue;

        if (progressDefinition.progress === progress && progressDefinition.title === title)
          continue;

        progressDefinition.progress = progress;
        progressDefinition.title = title;

        this.refreshProgress();
      }

      stop();
    });

    const stop = () => {
      if (stopped)
        return;

      stopped = true;

      this.progress.delete(progressIt);
      this.refreshProgress({delta: +1});
    };

    return {...promise, stop};
  }

  reportJson(data: any) {
    if (this.json) {
      this.writeLineWithForgettableReset(`${JSON.stringify(data)}`);
    }
  }

  async finalize() {
    if (!this.includeFooter)
      return;

    let installStatus = ``;

    if (this.errorCount > 0)
      installStatus = `Failed with errors`;
    else if (this.warningCount > 0)
      installStatus = `Done with warnings`;
    else
      installStatus = `Done`;

    const timing = formatUtils.pretty(this.configuration, Date.now() - this.startTime, formatUtils.Type.DURATION);
    const message = this.configuration.get(`enableTimers`)
      ? `${installStatus} in ${timing}`
      : installStatus;

    if (this.errorCount > 0) {
      this.reportError(MessageName.UNNAMED, message);
    } else if (this.warningCount > 0) {
      this.reportWarning(MessageName.UNNAMED, message);
    } else {
      this.reportInfo(MessageName.UNNAMED, message);
    }
  }

  private writeLine(str: string, {truncate}: {truncate?: boolean} = {}) {
    this.clearProgress({clear: true});
    this.stdout.write(`${this.truncate(str, {truncate})}\n`);
    this.writeProgress();
  }

  private writeLineWithForgettableReset(str: string, {truncate}: {truncate?: boolean} = {}) {
    this.forgettableLines = [];
    this.writeLine(str, {truncate});
  }

  private writeLines(lines: Array<string>, {truncate}: {truncate?: boolean} = {}) {
    this.clearProgress({delta: lines.length});

    for (const line of lines)
      this.stdout.write(`${this.truncate(line, {truncate})}\n`);

    this.writeProgress();
  }

  private reportCacheChanges({cacheHitCount, cacheMissCount}: {cacheHitCount: number, cacheMissCount: number}) {
    const cacheHitDelta = this.cacheHitCount - cacheHitCount;
    const cacheMissDelta = this.cacheMissCount - cacheMissCount;

    if (cacheHitDelta === 0 && cacheMissDelta === 0)
      return;

    let fetchStatus = ``;

    if (this.cacheHitCount > 1)
      fetchStatus += `${this.cacheHitCount} packages were already cached`;
    else if (this.cacheHitCount === 1)
      fetchStatus += ` - one package was already cached`;
    else
      fetchStatus += `No packages were cached`;

    if (this.cacheHitCount > 0) {
      if (this.cacheMissCount > 1) {
        fetchStatus += `, ${this.cacheMissCount} had to be fetched`;
      } else if (this.cacheMissCount === 1) {
        fetchStatus += `, one had to be fetched (${structUtils.prettyLocator(this.configuration, this.lastCacheMiss!)})`;
      }
    } else {
      if (this.cacheMissCount > 1) {
        fetchStatus += ` - ${this.cacheMissCount} packages had to be fetched`;
      } else if (this.cacheMissCount === 1) {
        fetchStatus += ` - one package had to be fetched (${structUtils.prettyLocator(this.configuration, this.lastCacheMiss!)})`;
      }
    }

    this.reportInfo(MessageName.FETCH_NOT_CACHED, fetchStatus);
  }

  private commit() {
    const marks = this.uncommitted;
    this.uncommitted = new Set();

    for (const mark of marks) {
      mark.committed = true;
      mark.action();
    }
  }

  private clearProgress({delta = 0, clear = false}: {delta?: number, clear?: boolean}) {
    if (this.progressStyle === null)
      return;

    if (this.progress.size + delta > 0) {
      this.stdout.write(`\x1b[${this.progress.size + delta}A`);
      if (delta > 0 || clear) {
        this.stdout.write(`\x1b[0J`);
      }
    }
  }

  private writeProgress() {
    if (this.progressStyle === null)
      return;

    if (this.progressTimeout !== null)
      clearTimeout(this.progressTimeout);

    this.progressTimeout = null;

    if (this.progress.size === 0)
      return;

    const now = Date.now();

    if (now - this.progressTime > PROGRESS_INTERVAL) {
      this.progressFrame = (this.progressFrame + 1) % PROGRESS_FRAMES.length;
      this.progressTime = now;
    }

    const spinner = PROGRESS_FRAMES[this.progressFrame];

    for (const progress of this.progress.values()) {
      let progressBar = ``;

      if (typeof progress.lastScaledSize !== `undefined`) {
        const ok = this.progressStyle.chars[0].repeat(progress.lastScaledSize);
        const ko = this.progressStyle.chars[1].repeat(this.progressMaxScaledSize! - progress.lastScaledSize);
        progressBar = ` ${ok}${ko}`;
      }

      const formattedName = this.formatName(null);
      const prefix = formattedName ? `${formattedName}: ` : ``;
      const title = progress.definition.title ? ` ${progress.definition.title}` : ``;

      this.stdout.write(`${formatUtils.pretty(this.configuration, `➤`, `blueBright`)} ${prefix}${spinner}${progressBar}${title}\n`);
    }

    this.progressTimeout = setTimeout(() => {
      this.refreshProgress({force: true});
    }, PROGRESS_INTERVAL);
  }

  private refreshProgress({delta = 0, force = false}: {delta?: number, force?: boolean} = {}) {
    let needsUpdate = false;
    let needsClear = false;

    if (force || this.progress.size === 0) {
      needsUpdate = true;
    } else {
      for (const progress of this.progress.values()) {
        const refreshedScaledSize = typeof progress.definition.progress !== `undefined`
          ? Math.trunc(this.progressMaxScaledSize! * progress.definition.progress)
          : undefined;

        const previousScaledSize = progress.lastScaledSize;
        progress.lastScaledSize = refreshedScaledSize;

        const previousTitle = progress.lastTitle;
        progress.lastTitle = progress.definition.title;

        if ((refreshedScaledSize !== previousScaledSize) || (needsClear = previousTitle !== progress.definition.title)) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate) {
      this.clearProgress({delta, clear: needsClear});
      this.writeProgress();
    }
  }

  private truncate(str: string, {truncate}: {truncate?: boolean} = {}) {
    if (this.progressStyle === null)
      truncate = false;

    if (typeof truncate === `undefined`)
      truncate = this.configuration.get(`preferTruncatedLines`);

    // The -1 is to account for terminals that would wrap after
    // the last column rather before the first overwrite
    if (truncate)
      str = sliceAnsi(str, 0, (this.stdout as WriteStream).columns - 1);

    return str;
  }

  private formatName(name: MessageName | null) {
    return formatName(name, {
      configuration: this.configuration,
      json: this.json,
    });
  }

  private formatNameWithHyperlink(name: MessageName | null) {
    return formatNameWithHyperlink(name, {
      configuration: this.configuration,
      json: this.json,
    });
  }

  private formatIndent() {
    return `│ `.repeat(this.indent);
  }
}
