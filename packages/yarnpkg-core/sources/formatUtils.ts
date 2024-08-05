import {npath}                                                              from '@yarnpkg/fslib';
import chalk                                                                from 'chalk';
import CI                                                                   from 'ci-info';
import {ColorFormat, formatMarkdownish}                                     from 'clipanion';
import micromatch                                                           from 'micromatch';
import stripAnsi                                                            from 'strip-ansi';
import {inspect}                                                            from 'util';

import {Configuration, ConfigurationValueMap}                               from './Configuration';
import {MessageName, stringifyMessageName}                                  from './MessageName';
import {Report}                                                             from './Report';
import * as miscUtils                                                       from './miscUtils';
import * as structUtils                                                     from './structUtils';
import {Descriptor, Locator, Ident, PackageExtension, PackageExtensionType} from './types';

export {stripAnsi};

// We have to workaround a TS bug:
// https://github.com/microsoft/TypeScript/issues/35329
//
// We also can't use const enum because Babel doesn't support them:
// https://github.com/babel/babel/issues/8741
//
export const Type = {
  NO_HINT: `NO_HINT`,

  ID: `ID`,

  NULL: `NULL`,

  SCOPE: `SCOPE`,
  NAME: `NAME`,
  RANGE: `RANGE`,
  REFERENCE: `REFERENCE`,

  NUMBER: `NUMBER`,
  PATH: `PATH`,
  URL: `URL`,
  ADDED: `ADDED`,
  REMOVED: `REMOVED`,
  CODE: `CODE`,
  INSPECT: `INSPECT`,

  DURATION: `DURATION`,
  SIZE: `SIZE`,
  SIZE_DIFF: `SIZE_DIFF`,

  IDENT: `IDENT`,
  DESCRIPTOR: `DESCRIPTOR`,
  LOCATOR: `LOCATOR`,
  RESOLUTION: `RESOLUTION`,
  DEPENDENT: `DEPENDENT`,
  PACKAGE_EXTENSION: `PACKAGE_EXTENSION`,
  SETTING: `SETTING`,

  MARKDOWN: `MARKDOWN`,
  MARKDOWN_INLINE: `MARKDOWN_INLINE`,
} as const;

export type Type = keyof typeof Type;

export enum Style {
  BOLD = 1 << 1,
}

const chalkOptions = CI.GITHUB_ACTIONS
  ? {level: 2}
  : chalk.supportsColor
    ? {level: chalk.supportsColor.level}
    : {level: 0};

export const supportsColor = chalkOptions.level !== 0;
export const supportsHyperlinks = supportsColor && !CI.GITHUB_ACTIONS && !CI.CIRCLE && !CI.GITLAB;

const chalkInstance = new chalk.Instance(chalkOptions);

const colors = new Map<Type, [string, number] | null>([
  [Type.NO_HINT, null],

  [Type.NULL, [`#a853b5`, 129]],

  [Type.SCOPE, [`#d75f00`, 166]],
  [Type.NAME, [`#d7875f`, 173]],
  [Type.RANGE, [`#00afaf`, 37]],
  [Type.REFERENCE, [`#87afff`, 111]],

  [Type.NUMBER, [`#ffd700`, 220]],
  [Type.PATH, [`#d75fd7`, 170]],
  [Type.URL, [`#d75fd7`, 170]],
  [Type.ADDED, [`#5faf00`, 70]],
  [Type.REMOVED, [`#ff3131`, 160]],
  [Type.CODE, [`#87afff`, 111]],

  [Type.SIZE, [`#ffd700`, 220]],
]);

// Just to make sure that the individual fields of the transform map have
// compatible parameter types, without upcasting the map to a too generic type
//
// We also take the opportunity to downcast the configuration into `any`,
// otherwise TypeScript will detect a circular reference and won't allow us to
// properly type the `format` method from Configuration. Since transforms are
// internal to this file, it should be fine.
const validateTransform = <T>(spec: {
  pretty: (configuration: any, val: T) => string;
  json: (val: T) => any;
}): {
  pretty: (configuration: any, val: T) => string;
  json: (val: T) => any;
} => spec;

function sizeToText(size: number) {
  const thresholds = [`KiB`, `MiB`, `GiB`, `TiB`];

  let power = thresholds.length;
  while (power > 1 && size < 1024 ** power)
    power -= 1;

  const factor = 1024 ** power;
  const value = Math.floor(size * 100 / factor) / 100;

  return `${value} ${thresholds[power - 1]}`;
}

const transforms = {
  [Type.ID]: validateTransform({
    pretty: (configuration: Configuration, value: number | string) => {
      if (typeof value === `number`) {
        return applyColor(configuration, `${value}`, Type.NUMBER);
      } else {
        return applyColor(configuration, value, Type.CODE);
      }
    },
    json: (id: number | string) => {
      return id;
    },
  }),

  [Type.INSPECT]: validateTransform({
    pretty: (configuration: Configuration, value: any) => {
      return inspect(value, {depth: Infinity, colors: configuration.get(`enableColors`), compact: true, breakLength: Infinity});
    },
    json: (value: any) => {
      return value;
    },
  }),

  [Type.NUMBER]: validateTransform({
    pretty: (configuration: Configuration, value: number) => {
      return applyColor(configuration, `${value}`, Type.NUMBER);
    },
    json: (value: number) => {
      return value;
    },
  }),

  [Type.IDENT]: validateTransform({
    pretty: (configuration: Configuration, ident: Ident) => {
      return structUtils.prettyIdent(configuration, ident);
    },
    json: (ident: Ident) => {
      return structUtils.stringifyIdent(ident);
    },
  }),

  [Type.LOCATOR]: validateTransform({
    pretty: (configuration: Configuration, locator: Locator) => {
      return structUtils.prettyLocator(configuration, locator);
    },
    json: (locator: Locator) => {
      return structUtils.stringifyLocator(locator);
    },
  }),

  [Type.DESCRIPTOR]: validateTransform({
    pretty: (configuration: Configuration, descriptor: Descriptor) => {
      return structUtils.prettyDescriptor(configuration, descriptor);
    },
    json: (descriptor: Descriptor) => {
      return structUtils.stringifyDescriptor(descriptor);
    },
  }),

  [Type.RESOLUTION]: validateTransform({
    pretty: (configuration: Configuration, {descriptor, locator}: {descriptor: Descriptor, locator: Locator | null}) => {
      return structUtils.prettyResolution(configuration, descriptor, locator);
    },
    json: ({descriptor, locator}: {descriptor: Descriptor, locator: Locator | null}) => {
      return {
        descriptor: structUtils.stringifyDescriptor(descriptor),
        locator: locator !== null
          ? structUtils.stringifyLocator(locator)
          : null,
      };
    },
  }),

  [Type.DEPENDENT]: validateTransform({
    pretty: (configuration: Configuration, {locator, descriptor}: {locator: Locator, descriptor: Descriptor}) => {
      return structUtils.prettyDependent(configuration, locator, descriptor);
    },
    json: ({locator, descriptor}: {locator: Locator, descriptor: Descriptor}) => {
      return {
        locator: structUtils.stringifyLocator(locator),
        descriptor: structUtils.stringifyDescriptor(descriptor),
      };
    },
  }),

  [Type.PACKAGE_EXTENSION]: validateTransform({
    pretty: (configuration: Configuration, packageExtension: PackageExtension) => {
      switch (packageExtension.type) {
        case PackageExtensionType.Dependency:
          return `${structUtils.prettyIdent(configuration, packageExtension.parentDescriptor)} ➤ ${applyColor(configuration, `dependencies`, Type.CODE)} ➤ ${structUtils.prettyIdent(configuration, packageExtension.descriptor)}`;
        case PackageExtensionType.PeerDependency:
          return `${structUtils.prettyIdent(configuration, packageExtension.parentDescriptor)} ➤ ${applyColor(configuration, `peerDependencies`, Type.CODE)} ➤ ${structUtils.prettyIdent(configuration, packageExtension.descriptor)}`;
        case PackageExtensionType.PeerDependencyMeta:
          return `${structUtils.prettyIdent(configuration, packageExtension.parentDescriptor)} ➤ ${applyColor(configuration, `peerDependenciesMeta`, Type.CODE)} ➤ ${structUtils.prettyIdent(configuration, structUtils.parseIdent(packageExtension.selector))} ➤ ${applyColor(configuration, packageExtension.key, Type.CODE)}`;
        default:
          throw new Error(`Assertion failed: Unsupported package extension type: ${(packageExtension as PackageExtension).type}`);
      }
    },
    json: (packageExtension: PackageExtension) => {
      switch (packageExtension.type) {
        case PackageExtensionType.Dependency:
          return `${structUtils.stringifyIdent(packageExtension.parentDescriptor)} > ${structUtils.stringifyIdent(packageExtension.descriptor)}`;
        case PackageExtensionType.PeerDependency:
          return `${structUtils.stringifyIdent(packageExtension.parentDescriptor)} >> ${structUtils.stringifyIdent(packageExtension.descriptor)}`;
        case PackageExtensionType.PeerDependencyMeta:
          return `${structUtils.stringifyIdent(packageExtension.parentDescriptor)} >> ${packageExtension.selector} / ${packageExtension.key}`;
        default:
          throw new Error(`Assertion failed: Unsupported package extension type: ${(packageExtension as PackageExtension).type}`);
      }
    },
  }),

  [Type.SETTING]: validateTransform({
    pretty: (configuration: Configuration, settingName: keyof ConfigurationValueMap) => {
      // Asserts that the setting is valid
      configuration.get(settingName);

      return applyHyperlink(configuration, applyColor(configuration, settingName, Type.CODE), `https://yarnpkg.com/configuration/yarnrc#${settingName}`);
    },
    json: (settingName: string) => {
      return settingName;
    },
  }),

  [Type.DURATION]: validateTransform({
    pretty: (configuration: Configuration, duration: number) => {
      if (duration > 1000 * 60) {
        const minutes = Math.floor(duration / 1000 / 60);
        const seconds = Math.ceil((duration - minutes * 60 * 1000) / 1000);
        return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
      } else {
        const seconds = Math.floor(duration / 1000);
        const milliseconds = duration - seconds * 1000;
        return milliseconds === 0 ? `${seconds}s` : `${seconds}s ${milliseconds}ms`;
      }
    },
    json: (duration: number) => {
      return duration;
    },
  }),

  [Type.SIZE]: validateTransform({
    pretty: (configuration: Configuration, size: number) => {
      return applyColor(configuration, sizeToText(size), Type.NUMBER);
    },
    json: (size: number) => {
      return size;
    },
  }),

  [Type.SIZE_DIFF]: validateTransform({
    pretty: (configuration: Configuration, size: number) => {
      const sign = size >= 0 ? `+` : `-`;

      // We're reversing the color logic here because, in general, an increase
      // in size is typically seen as a bad thing, so it should be red
      const type = sign === `+` ? Type.REMOVED : Type.ADDED;

      return applyColor(configuration, `${sign} ${sizeToText(Math.max(Math.abs(size), 1))}`, type);
    },
    json: (size: number) => {
      return size;
    },
  }),

  [Type.PATH]: validateTransform({
    pretty: (configuration: Configuration, filePath: string) => {
      return applyColor(configuration, npath.fromPortablePath(filePath), Type.PATH);
    },
    json: (filePath: string) => {
      return npath.fromPortablePath(filePath) as string;
    },
  }),

  [Type.MARKDOWN]: validateTransform({
    pretty: (configuration: Configuration, {text, format, paragraphs}: {text: string, format: ColorFormat, paragraphs: boolean}) => {
      return formatMarkdownish(text, {format, paragraphs});
    },
    json: ({text}: {text: string, format: ColorFormat, paragraphs: boolean}) => {
      return text;
    },
  }),

  [Type.MARKDOWN_INLINE]: validateTransform({
    pretty: (configuration: Configuration, text: string) => {
      // Highlight the code segments
      text = text.replace(/(`+)((?:.|[\n])*?)\1/g, ($0, $1, $2) => {
        return pretty(configuration, $1 + $2 + $1, Type.CODE);
      });

      // Highlight the bold segments
      text = text.replace(/(\*\*)((?:.|[\n])*?)\1/g, ($0, $1, $2) => {
        return applyStyle(configuration, $2, Style.BOLD);
      });

      return text;
    },
    json: (text: string) => {
      return text;
    },
  }),
};

type AllTransforms = typeof transforms;

export type Source<T> = T extends keyof AllTransforms
  ? Parameters<AllTransforms[T]['json']>[0] | null
  : string | null;

export type Tuple<T extends Type = Type> =
  readonly [Source<T>, T];

export type Field = {
  label: string;
  value: Tuple<any>;
};

export function tuple<T extends Type>(formatType: T, value: Source<T>): Tuple<T> {
  return [value, formatType];
}

export function applyStyle(configuration: Configuration, text: string, flags: Style): string {
  if (!configuration.get(`enableColors`))
    return text;

  if (flags & Style.BOLD)
    text = chalk.bold(text);

  return text;
}

export function applyColor(configuration: Configuration, value: string, formatType: Type | string): string {
  if (!configuration.get(`enableColors`))
    return value;

  const colorSpec = colors.get(formatType as Type);
  if (colorSpec === null)
    return value;

  const color = typeof colorSpec === `undefined`
    ? formatType
    : chalkOptions.level >= 3
      ? colorSpec[0]
      : colorSpec[1];

  const fn = typeof color === `number`
    ? chalkInstance.ansi256(color)
    : color.startsWith(`#`)
      ? chalkInstance.hex(color)
      : (chalkInstance as any)[color];

  if (typeof fn !== `function`)
    throw new Error(`Invalid format type ${color}`);

  return fn(value);
}

const isKonsole = !!process.env.KONSOLE_VERSION;

export function applyHyperlink(configuration: Configuration, text: string, href: string) {
  // Only print hyperlinks if allowed per configuration
  if (!configuration.get(`enableHyperlinks`))
    return text;

  // We use ESC as ST for Konsole because it doesn't support
  // the non-standard BEL character for hyperlinks
  if (isKonsole)
    return `\u001b]8;;${href}\u001b\\${text}\u001b]8;;\u001b\\`;

  // We use BELL as ST because it seems that iTerm doesn't properly support
  // the \x1b\\ sequence described in the reference document
  // https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda#the-escape-sequence
  return `\u001b]8;;${href}\u0007${text}\u001b]8;;\u0007`;
}

export function pretty<T extends Type>(configuration: Configuration, value: Source<T>, formatType: T | string): string {
  if (value === null)
    return applyColor(configuration, `null`, Type.NULL);

  if (Object.hasOwn(transforms, formatType)) {
    const transform = transforms[formatType as keyof typeof transforms];
    const typedTransform = transform as Extract<typeof transform, {pretty: (configuration: Configuration, val: Source<T>) => any}>;
    return typedTransform.pretty(configuration, value);
  }

  if (typeof value !== `string`)
    throw new Error(`Assertion failed: Expected the value to be a string, got ${typeof value}`);

  return applyColor(configuration, value, formatType);
}

export function prettyList<T extends Type>(configuration: Configuration, values: Iterable<Source<T>>, formatType: T | string, {separator = `, `}: {separator?: string} = {}): string {
  return [...values].map(value => pretty(configuration, value, formatType)).join(separator);
}

export function json<T extends Type>(value: Source<T>, formatType: T | string): any {
  if (value === null)
    return null;

  if (Object.hasOwn(transforms, formatType)) {
    miscUtils.overrideType<keyof AllTransforms>(formatType);
    return transforms[formatType].json(value as never);
  }

  if (typeof value !== `string`)
    throw new Error(`Assertion failed: Expected the value to be a string, got ${typeof value}`);

  return value;
}

export function jsonOrPretty<T extends Type>(outputJson: boolean, configuration: Configuration, [value, formatType]: Tuple<T>) {
  return outputJson
    ? json(value, formatType)
    : pretty(configuration, value, formatType);
}

export function mark(configuration: Configuration) {
  return {
    Check: applyColor(configuration, `✓`, `green`),
    Cross: applyColor(configuration, `✘`, `red`),
    Question: applyColor(configuration, `?`, `cyan`),
  };
}

export function prettyField(configuration: Configuration, {label, value: [value, formatType]}: Field) {
  return `${pretty(configuration, label, Type.CODE)}: ${pretty(configuration, value, formatType)}`;
}

export function prettyTruncatedLocatorList(configuration: Configuration, locators: Array<Locator>, recommendedLength: number) {
  const named: Array<[string, number]> = [];
  const locatorsCopy = [...locators];

  let remainingLength = recommendedLength;
  while (locatorsCopy.length > 0) {
    const locator = locatorsCopy[0]!;

    const asString = `${structUtils.prettyLocator(configuration, locator)}, `;
    const asLength = structUtils.prettyLocatorNoColors(locator).length + 2;

    if (named.length > 0 && remainingLength < asLength)
      break;

    named.push([asString, asLength]);
    remainingLength -= asLength;

    locatorsCopy.shift();
  }

  if (locatorsCopy.length === 0)
    return named.map(([str]) => str).join(``)
      // Don't forget the trailing ", "
      .slice(0, -2);

  const mark = `X`.repeat(locatorsCopy.length.toString().length);
  const suffix = `and ${mark} more.`;

  let otherCount = locatorsCopy.length;
  while (named.length > 1 && remainingLength < suffix.length) {
    remainingLength += named[named.length - 1][1];

    otherCount += 1;
    named.pop();
  }

  return [
    named.map(([str]) => str).join(``),
    suffix.replace(mark, pretty(configuration, otherCount, Type.NUMBER)),
  ].join(``);
}

export enum LogLevel {
  Error = `error`,
  Warning = `warning`,
  Info = `info`,
  Discard = `discard`,
}

/**
 * Add support support for the `logFilters` setting to the specified Report
 * instance.
 */
export function addLogFilterSupport(report: Report, {configuration}: {configuration: Configuration}) {
  const logFilters = configuration.get(`logFilters`);

  const logFiltersByCode = new Map<string, LogLevel | null>();
  const logFiltersByText = new Map<string, LogLevel | null>();
  const logFiltersByPatternMatcher: Array<[(str: string) => boolean, LogLevel | null]> = [];

  for (const filter of logFilters) {
    const level = filter.get(`level`);
    if (typeof level === `undefined`)
      continue;

    const code = filter.get(`code`);
    if (typeof code !== `undefined`)
      logFiltersByCode.set(code, level);

    const text = filter.get(`text`);
    if (typeof text !== `undefined`)
      logFiltersByText.set(text, level);

    const pattern = filter.get(`pattern`);
    if (typeof pattern !== `undefined`) {
      logFiltersByPatternMatcher.push([micromatch.matcher(pattern, {contains: true}), level]);
    }
  }

  // Higher priority to the last patterns, just like other filters
  logFiltersByPatternMatcher.reverse();

  const findLogLevel = (name: MessageName | null, text: string, defaultLevel: LogLevel) => {
    if (name === null || name === MessageName.UNNAMED)
      return defaultLevel;

    // Avoid processing the string unless we know we'll actually need it
    const strippedText = logFiltersByText.size > 0 || logFiltersByPatternMatcher.length > 0
      ? stripAnsi(text)
      : text;

    if (logFiltersByText.size > 0) {
      const level = logFiltersByText.get(strippedText);

      if (typeof level !== `undefined`) {
        return level ?? defaultLevel;
      }
    }

    if (logFiltersByPatternMatcher.length > 0) {
      for (const [filterMatcher, filterLevel] of logFiltersByPatternMatcher) {
        if (filterMatcher(strippedText)) {
          return filterLevel ?? defaultLevel;
        }
      }
    }

    if (logFiltersByCode.size > 0) {
      const level = logFiltersByCode.get(stringifyMessageName(name));
      if (typeof level !== `undefined`) {
        return level ?? defaultLevel;
      }
    }

    return defaultLevel;
  };

  const reportInfo = report.reportInfo;
  const reportWarning = report.reportWarning;
  const reportError = report.reportError;

  const routeMessage = function (report: Report, name: MessageName | null, text: string, level: LogLevel) {
    switch (findLogLevel(name, text, level)) {
      case LogLevel.Info: {
        reportInfo.call(report, name, text);
      } break;

      case LogLevel.Warning: {
        reportWarning.call(report, name ?? MessageName.UNNAMED, text);
      } break;

      case LogLevel.Error: {
        reportError.call(report, name ?? MessageName.UNNAMED, text);
      } break;
    }
  };

  report.reportInfo = function (...args) {
    return routeMessage(this, ...args, LogLevel.Info);
  };

  report.reportWarning = function (...args) {
    return routeMessage(this, ...args, LogLevel.Warning);
  };

  report.reportError = function (...args) {
    return routeMessage(this, ...args, LogLevel.Error);
  };
}
