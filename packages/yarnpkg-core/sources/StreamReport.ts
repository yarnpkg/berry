import sliceAnsi                                                                    from '@arcanis/slice-ansi';
import CI                                                                           from 'ci-info';
import {Writable}                                                                   from 'stream';
import {WriteStream}                                                                from 'tty';

import {Configuration}                                                              from './Configuration';
import {MessageName, stringifyMessageName}                                          from './MessageName';
import {ProgressDefinition, Report, SectionOptions, TimerOptions, ProgressIterable} from './Report';
import {YarnVersion}                                                                from './YarnVersion';
import * as formatUtils                                                             from './formatUtils';

export type StreamReportOptions = {
  configuration: Configuration;
  forceSectionAlignment?: boolean;
  includeFooter?: boolean;
  includeInfos?: boolean;
  includeLogs?: boolean;
  includeNames?: boolean;
  includeVersion?: boolean;
  includeWarnings?: boolean;
  includePrefix?: boolean;
  json?: boolean;
  stdout: Writable;
};

export const SINGLE_LINE_CHAR = `·`;

const PROGRESS_FRAMES = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`];
const PROGRESS_INTERVAL = 80;

const GROUP = CI.GITHUB_ACTIONS
  ? {start: (what: string) => `::group::${what}\n`, end: (what: string) => `::endgroup::\n`}
  : CI.TRAVIS
    ? {start: (what: string) => `travis_fold:start:${what}\n`, end: (what: string) => `travis_fold:end:${what}\n`}
    : CI.GITLAB
      ? {start: (what: string) => `section_start:${Math.floor(Date.now() / 1000)}:${what.toLowerCase().replace(/\W+/g, `_`)}[collapsed=true]\r\x1b[0K${what}\n`, end: (what: string) => `section_end:${Math.floor(Date.now() / 1000)}:${what.toLowerCase().replace(/\W+/g, `_`)}\r\x1b[0K`}
      : null;

export const SUPPORTS_GROUPS = GROUP !== null;

const now = new Date();

// We only want to support environments that will out-of-the-box accept the
// characters we want to use. Others can enforce the style from the project
// configuration.
const supportsEmojis = [`iTerm.app`, `Apple_Terminal`, `WarpTerminal`, `vscode`].includes(process.env.TERM_PROGRAM!) || !!process.env.WT_SESSION;

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

    if (opts.includeVersion)
      report.reportInfo(MessageName.UNNAMED, formatUtils.applyStyle(opts.configuration, `Yarn ${YarnVersion}`, formatUtils.Style.BOLD));

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
  private forceSectionAlignment: boolean;
  private includeNames: boolean;
  private includePrefix: boolean;
  private includeFooter: boolean;
  private includeInfos: boolean;
  private includeWarnings: boolean;
  private json: boolean;
  private stdout: Writable;

  private uncommitted = new Set<{
    committed: boolean;
    action: () => void;
  }>();

  private warningCount: number = 0;
  private errorCount: number = 0;

  private timerFooter: Array<() => void> = [];

  private startTime: number = Date.now();

  private indent: number = 0;
  private level: number = 0;

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

  constructor({
    configuration,
    stdout,
    json = false,
    forceSectionAlignment = false,
    includeNames = true,
    includePrefix = true,
    includeFooter = true,
    includeLogs = !json,
    includeInfos = includeLogs,
    includeWarnings = includeLogs,
  }: StreamReportOptions) {
    super();

    formatUtils.addLogFilterSupport(this, {configuration});

    this.configuration = configuration;
    this.forceSectionAlignment = forceSectionAlignment;
    this.includeNames = includeNames;
    this.includePrefix = includePrefix;
    this.includeFooter = includeFooter;
    this.includeInfos = includeInfos;
    this.includeWarnings = includeWarnings;
    this.json = json;
    this.stdout = stdout;

    // Setup progress
    if (configuration.get(`enableProgressBars`) && !json && (stdout as WriteStream).isTTY && (stdout as WriteStream).columns > 22) {
      const styleName = configuration.get(`progressBarStyle`) || defaultStyle;
      if (!Object.hasOwn(PROGRESS_STYLES, styleName))
        throw new Error(`Assertion failed: Invalid progress bar style`);

      this.progressStyle = PROGRESS_STYLES[styleName];

      const maxWidth = Math.min(this.getRecommendedLength(), 80);
      this.progressMaxScaledSize = Math.floor(this.progressStyle.size * maxWidth / 80);
    }
  }

  hasErrors() {
    return this.errorCount > 0;
  }

  exitCode() {
    return this.hasErrors() ? 1 : 0;
  }

  getRecommendedLength() {
    const PREFIX_SIZE = `➤ YN0000: `.length;

    // The -1 is to account for terminals that would wrap after
    // the last column rather before the first overwrite
    const recommendedLength = this.progressStyle !== null
      ? (this.stdout as WriteStream).columns - 1
      : super.getRecommendedLength();

    return Math.max(40, recommendedLength - PREFIX_SIZE - this.indent * 2);
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
        this.level += 1;

        this.reportInfo(null, `┌ ${what}`);
        this.indent += 1;

        if (GROUP !== null && !this.json && this.includeInfos) {
          this.stdout.write(GROUP.start(what));
        }
      },
      reportFooter: elapsedTime => {
        this.indent -= 1;

        if (GROUP !== null && !this.json && this.includeInfos) {
          this.stdout.write(GROUP.end(what));
          for (const cb of this.timerFooter) {
            cb();
          }
        }

        if (this.configuration.get(`enableTimers`) && elapsedTime > 200)
          this.reportInfo(null, `└ Completed in ${formatUtils.pretty(this.configuration, elapsedTime, formatUtils.Type.DURATION)}`);
        else
          this.reportInfo(null, `└ Completed`);

        this.level -= 1;
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

  reportSeparator() {
    if (this.indent === 0) {
      this.writeLine(``);
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
    const message = `${this.formatPrefix(prefix, `blueBright`)}${text}`;

    if (!this.json) {
      this.writeLine(message);
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
      this.writeLine(`${this.formatPrefix(prefix, `yellowBright`)}${text}`);
    } else {
      this.reportJson({type: `warning`, name, displayName: this.formatName(name), indent: this.formatIndent(), data: text});
    }
  }

  reportError(name: MessageName, text: string) {
    this.errorCount += 1;
    this.timerFooter.push(() => this.reportErrorImpl(name, text));

    this.reportErrorImpl(name, text);
  }

  reportErrorImpl(name: MessageName, text: string) {
    this.commit();

    const formattedName = this.formatNameWithHyperlink(name);
    const prefix = formattedName ? `${formattedName}: ` : ``;

    if (!this.json) {
      this.writeLine(`${this.formatPrefix(prefix, `redBright`)}${text}`, {truncate: false});
    } else {
      this.reportJson({type: `error`, name, displayName: this.formatName(name), indent: this.formatIndent(), data: text});
    }
  }

  reportFold(title: string, text: string) {
    if (!GROUP)
      return;

    const message = `${GROUP.start(title)}${text}${GROUP.end(title)}`;
    this.timerFooter.push(() => this.stdout.write(message));
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
      this.writeLine(`${JSON.stringify(data)}`);
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

  private writeLines(lines: Array<string>, {truncate}: {truncate?: boolean} = {}) {
    this.clearProgress({delta: lines.length});

    for (const line of lines)
      this.stdout.write(`${this.truncate(line, {truncate})}\n`);

    this.writeProgress();
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
    if (!this.includeNames)
      return ``;

    return formatName(name, {
      configuration: this.configuration,
      json: this.json,
    });
  }

  private formatPrefix(prefix: string, caretColor: string) {
    return this.includePrefix
      ? `${formatUtils.pretty(this.configuration, `➤`, caretColor)} ${prefix}${this.formatIndent()}`
      : ``;
  }

  private formatNameWithHyperlink(name: MessageName | null) {
    if (!this.includeNames)
      return ``;

    return formatNameWithHyperlink(name, {
      configuration: this.configuration,
      json: this.json,
    });
  }

  private formatIndent() {
    return this.level > 0 || !this.forceSectionAlignment
      ? `│ `.repeat(this.indent)
      : `${SINGLE_LINE_CHAR} `;
  }
}
