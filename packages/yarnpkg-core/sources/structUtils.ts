import {Filename, PortablePath}                    from '@yarnpkg/fslib';
import querystring                                 from 'querystring';
import semver                                      from 'semver';
import {makeParser}                                from 'tinylogic';

import {Configuration}                             from './Configuration';
import type {PeerRequestNode, PeerRequirementNode} from './Project';
import {Workspace}                                 from './Workspace';
import * as formatUtils                            from './formatUtils';
import * as hashUtils                              from './hashUtils';
import * as miscUtils                              from './miscUtils';
import * as nodeUtils                              from './nodeUtils';
import * as structUtils                            from './structUtils';
import {IdentHash, DescriptorHash, LocatorHash}    from './types';
import {Ident, Descriptor, Locator, Package}       from './types';

const VIRTUAL_PROTOCOL = `virtual:`;
const VIRTUAL_ABBREVIATE = 5;

const CONDITION_REGEX = /(os|cpu|libc)=([a-z0-9_-]+)/;
const conditionParser = makeParser(CONDITION_REGEX);

/**
 * Creates a package ident.
 *
 * @param scope The package scope without the `@` prefix (eg. `types`)
 * @param name The name of the package
 */
export function makeIdent(scope: string | null, name: string): Ident {
  if (scope?.startsWith(`@`))
    throw new Error(`Invalid scope: don't prefix it with '@'`);

  return {identHash: hashUtils.makeHash<IdentHash>(scope, name), scope, name};
}

/**
 * Creates a package descriptor.
 *
 * @param ident The base ident (see `makeIdent`)
 * @param range The range to attach (eg. `^1.0.0`)
 */
export function makeDescriptor(ident: Ident, range: string): Descriptor {
  return {identHash: ident.identHash, scope: ident.scope, name: ident.name, descriptorHash: hashUtils.makeHash<DescriptorHash>(ident.identHash, range), range};
}

/**
 * Creates a package locator.
 *
 * @param ident The base ident (see `makeIdent`)
 * @param reference The reference to attach (eg. `1.0.0`)
 */
export function makeLocator(ident: Ident, reference: string): Locator {
  return {identHash: ident.identHash, scope: ident.scope, name: ident.name, locatorHash: hashUtils.makeHash<LocatorHash>(ident.identHash, reference), reference};
}

/**
 * Turns a compatible source to an ident. You won't really have to use this
 * function since by virtue of structural inheritance all descriptors and
 * locators are already valid idents.
 *
 * This function is only useful if you absolutely need to remove the non-ident
 * fields from a structure before storing it somewhere.
 *
 * @param source The data structure to convert into an ident.
 */
export function convertToIdent(source: Descriptor | Locator | Package): Ident {
  return {identHash: source.identHash, scope: source.scope, name: source.name};
}

/**
 * Turns a descriptor into a locator.
 *
 * Note that this process may be unsafe, as descriptors may reference multiple
 * packages, putting them at odd with locators' expected semantic. Only makes
 * sense when used with single-resolution protocols, for instance `file:`.
 *
 * @param descriptor The descriptor to convert into a locator.
 */
export function convertDescriptorToLocator(descriptor: Descriptor): Locator {
  return {identHash: descriptor.identHash, scope: descriptor.scope, name: descriptor.name, locatorHash: descriptor.descriptorHash as unknown as LocatorHash, reference: descriptor.range};
}

/**
 * Turns a locator into a descriptor.
 *
 * This should be safe to do regardless of the locator, since all locator
 * references are expected to be valid descriptor ranges.
 *
 * @param locator The locator to convert into a descriptor.
 */
export function convertLocatorToDescriptor(locator: Locator): Descriptor {
  return {identHash: locator.identHash, scope: locator.scope, name: locator.name, descriptorHash: locator.locatorHash as unknown as DescriptorHash, range: locator.reference};
}

/**
 * Turns a package structure into a simple locator. You won't often need to
 * call this function since packages are already valid locators by virtue of
 * structural inheritance.
 *
 * This function is only useful if you absolutely need to remove the
 * non-locator fields from a structure before storing it somewhere.
 *
 * @param pkg The package to convert into a locator.
 */
export function convertPackageToLocator(pkg: Package): Locator {
  return {identHash: pkg.identHash, scope: pkg.scope, name: pkg.name, locatorHash: pkg.locatorHash, reference: pkg.reference};
}

/**
 * Deep copies a package then change its locator to something else.
 *
 * @param pkg The source package
 * @param locator Its new new locator
 */
export function renamePackage(pkg: Package, locator: Locator): Package {
  return {
    identHash: locator.identHash,
    scope: locator.scope,
    name: locator.name,

    locatorHash: locator.locatorHash,
    reference: locator.reference,

    version: pkg.version,

    languageName: pkg.languageName,
    linkType: pkg.linkType,

    conditions: pkg.conditions,

    dependencies: new Map(pkg.dependencies),
    peerDependencies: new Map(pkg.peerDependencies),

    dependenciesMeta: new Map(pkg.dependenciesMeta),
    peerDependenciesMeta: new Map(pkg.peerDependenciesMeta),

    bin: new Map(pkg.bin),
  };
}

/**
 * Deep copies a package. The copy will share the same locator as the original.
 *
 * @param pkg The source package
 */
export function copyPackage(pkg: Package) {
  return renamePackage(pkg, pkg);
}

/**
 * Creates a new virtual descriptor from a non virtual one.
 *
 * @param descriptor The descriptor to virtualize
 * @param entropy A hash that provides uniqueness to this virtualized descriptor (normally a locator hash)
 */
export function virtualizeDescriptor(descriptor: Descriptor, entropy: string): Descriptor {
  if (entropy.includes(`#`))
    throw new Error(`Invalid entropy`);

  return makeDescriptor(descriptor, `virtual:${entropy}#${descriptor.range}`);
}

/**
 * Creates a new virtual package from a non virtual one.
 *
 * @param pkg The package to virtualize
 * @param entropy A hash that provides uniqueness to this virtualized package (normally a locator hash)
 */
export function virtualizePackage(pkg: Package, entropy: string): Package {
  if (entropy.includes(`#`))
    throw new Error(`Invalid entropy`);

  return renamePackage(pkg, makeLocator(pkg, `virtual:${entropy}#${pkg.reference}`));
}

/**
 * Returns `true` if the descriptor is virtual.
 */
export function isVirtualDescriptor(descriptor: Descriptor): boolean {
  return descriptor.range.startsWith(VIRTUAL_PROTOCOL);
}

/**
 * Returns `true` if the locator is virtual.
 */
export function isVirtualLocator(locator: Locator): boolean {
  return locator.reference.startsWith(VIRTUAL_PROTOCOL);
}

const VIRTUAL_PREFIX_REGEXP = /^[^#]*#/;

/**
 * Returns a new devirtualized descriptor based on a virtualized descriptor
 */
export function devirtualizeDescriptor(descriptor: Descriptor): Descriptor {
  if (!isVirtualDescriptor(descriptor))
    throw new Error(`Not a virtual descriptor`);

  return makeDescriptor(descriptor, descriptor.range.replace(VIRTUAL_PREFIX_REGEXP, ``));
}

/**
 * Returns a new devirtualized locator based on a virtualized locator
 * @param locator the locator
 */
export function devirtualizeLocator(locator: Locator): Locator {
  if (!isVirtualLocator(locator))
    throw new Error(`Not a virtual descriptor`);

  return makeLocator(locator, locator.reference.replace(VIRTUAL_PREFIX_REGEXP, ``));
}

/**
 * Returns a descriptor guaranteed to be devirtualized
 */
export function ensureDevirtualizedDescriptor(descriptor: Descriptor): Descriptor {
  if (!isVirtualDescriptor(descriptor))
    return descriptor;

  return makeDescriptor(descriptor, descriptor.range.replace(VIRTUAL_PREFIX_REGEXP, ``));
}

/**
 * Returns a locator guaranteed to be devirtualized
 * @param locator the locator
 */
export function ensureDevirtualizedLocator(locator: Locator): Locator {
  if (!isVirtualLocator(locator))
    return locator;

  return makeLocator(locator, locator.reference.replace(VIRTUAL_PREFIX_REGEXP, ``));
}

/**
 * Some descriptors only make sense when bound with some internal state. For
 * instance that would be the case for the `file:` ranges, which require to
 * be bound to their parent packages in order to resolve relative paths from
 * the right location.
 *
 * This function will apply the specified parameters onto the requested
 * descriptor, but only if it didn't get bound before (important to handle the
 * case where we replace a descriptor by another, since when that happens the
 * replacement has probably been already bound).
 *
 * @param descriptor The original descriptor
 * @param params The parameters to encode in the range
 */
export function bindDescriptor(descriptor: Descriptor, params: {[key: string]: string}) {
  if (descriptor.range.includes(`::`))
    return descriptor;

  return makeDescriptor(descriptor, `${descriptor.range}::${querystring.stringify(params)}`);
}

/**
 * Some locators only make sense when bound with some internal state. For
 * instance that would be the case for the `file:` references, which require to
 * be bound to their parent packages in order to resolve relative paths from
 * the right location.
 *
 * This function will apply the specified parameters onto the requested
 * locator, but only if it didn't get bound before (important to handle the
 * case where we replace a locator by another, since when that happens the
 * replacement has probably been already bound).
 *
 * @param locator The original locator
 * @param params The parameters to encode in the reference
 */

export function bindLocator(locator: Locator, params: {[key: string]: string}) {
  if (locator.reference.includes(`::`))
    return locator;

  return makeLocator(locator, `${locator.reference}::${querystring.stringify(params)}`);
}

/**
 * Returns `true` if the idents are equal
 */
export function areIdentsEqual(a: Ident, b: Ident) {
  return a.identHash === b.identHash;
}

/**
 * Returns `true` if the descriptors are equal
 */
export function areDescriptorsEqual(a: Descriptor, b: Descriptor) {
  return a.descriptorHash === b.descriptorHash;
}

/**
 * Returns `true` if the locators are equal
 */
export function areLocatorsEqual(a: Locator, b: Locator) {
  return a.locatorHash === b.locatorHash;
}

/**
 * Virtual packages are considered equivalent when they belong to the same
 * package identity and have the same dependencies. Note that equivalence
 * is not the same as equality, as the references may be different.
 */
export function areVirtualPackagesEquivalent(a: Package, b: Package) {
  if (!isVirtualLocator(a))
    throw new Error(`Invalid package type`);
  if (!isVirtualLocator(b))
    throw new Error(`Invalid package type`);

  if (!areIdentsEqual(a, b))
    return false;

  if (a.dependencies.size !== b.dependencies.size)
    return false;

  for (const dependencyDescriptorA of a.dependencies.values()) {
    const dependencyDescriptorB = b.dependencies.get(dependencyDescriptorA.identHash);
    if (!dependencyDescriptorB)
      return false;

    if (!areDescriptorsEqual(dependencyDescriptorA, dependencyDescriptorB)) {
      return false;
    }
  }

  return true;
}

/**
 * Parses a string into an ident.
 *
 * Throws an error if the ident cannot be parsed.
 *
 * @param string The ident string (eg. `@types/lodash`)
 */
export function parseIdent(string: string): Ident {
  const ident = tryParseIdent(string);
  if (!ident)
    throw new Error(`Invalid ident (${string})`);

  return ident;
}

const IDENT_REGEXP = /^(?:@([^/]+?)\/)?([^@/]+)$/;

/**
 * Parses a string into an ident.
 *
 * Returns `null` if the ident cannot be parsed.
 *
 * @param string The ident string (eg. `@types/lodash`)
 */
export function tryParseIdent(string: string): Ident | null {
  const match = string.match(IDENT_REGEXP);
  if (!match)
    return null;

  const [, scope, name] = match;

  const realScope = typeof scope !== `undefined`
    ? scope
    : null;

  return makeIdent(realScope, name);
}

/**
 * Parses a `string` into a descriptor
 *
 * Throws an error if the descriptor cannot be parsed.
 *
 * @param string The descriptor string (eg. `lodash@^1.0.0`)
 * @param strict If `false`, the range is optional (`unknown` will be used as fallback)
 */
export function parseDescriptor(string: string, strict: boolean = false): Descriptor {
  const descriptor = tryParseDescriptor(string, strict);
  if (!descriptor)
    throw new Error(`Invalid descriptor (${string})`);

  return descriptor;
}

const DESCRIPTOR_REGEX_STRICT = /^(?:@([^/]+?)\/)?([^@/]+?)(?:@(.+))$/;
const DESCRIPTOR_REGEX_LOOSE = /^(?:@([^/]+?)\/)?([^@/]+?)(?:@(.+))?$/;

/**
 * Parses a `string` into a descriptor
 *
 * Returns `null` if the descriptor cannot be parsed.
 *
 * @param string The descriptor string (eg. `lodash@^1.0.0`)
 * @param strict If `false`, the range is optional (`unknown` will be used as fallback)
 */
export function tryParseDescriptor(string: string, strict: boolean = false): Descriptor | null {
  const match = strict
    ? string.match(DESCRIPTOR_REGEX_STRICT)
    : string.match(DESCRIPTOR_REGEX_LOOSE);

  if (!match)
    return null;

  const [, scope, name, range] = match;
  if (range === `unknown`)
    throw new Error(`Invalid range (${string})`);

  const realScope = typeof scope !== `undefined`
    ? scope
    : null;

  const realRange = typeof range !== `undefined`
    ? range
    : `unknown`;

  return makeDescriptor(makeIdent(realScope, name), realRange);
}

/**
 * Parses a `string` into a locator
 *
 * Throws an error if the locator cannot be parsed.
 *
 * @param string The locator `string` (eg. `lodash@1.0.0`)
 * @param strict If `false`, the reference is optional (`unknown` will be used as fallback)
 */
export function parseLocator(string: string, strict: boolean = false): Locator {
  const locator = tryParseLocator(string, strict);
  if (!locator)
    throw new Error(`Invalid locator (${string})`);

  return locator;
}

const LOCATOR_REGEX_STRICT = /^(?:@([^/]+?)\/)?([^@/]+?)(?:@(.+))$/;
const LOCATOR_REGEX_LOOSE = /^(?:@([^/]+?)\/)?([^@/]+?)(?:@(.+))?$/;

/**
 * Parses a `string` into a locator
 *
 * Returns `null` if the locator cannot be parsed.
 *
 * @param string The locator string (eg. `lodash@1.0.0`)
 * @param strict If `false`, the reference is optional (`unknown` will be used as fallback)
 */
export function tryParseLocator(string: string, strict: boolean = false): Locator | null {
  const match = strict
    ? string.match(LOCATOR_REGEX_STRICT)
    : string.match(LOCATOR_REGEX_LOOSE);

  if (!match)
    return null;

  const [, scope, name, reference] = match;
  if (reference === `unknown`)
    throw new Error(`Invalid reference (${string})`);

  const realScope = typeof scope !== `undefined`
    ? scope
    : null;

  const realReference = typeof reference !== `undefined`
    ? reference
    : `unknown`;

  return makeLocator(makeIdent(realScope, name), realReference);
}

type ParseRangeOptions = {
  /** Throw an error if bindings are missing */
  requireBindings?: boolean;
  /** Throw an error if the protocol is missing or is not the specified one */
  requireProtocol?: boolean | string;
  /** Throw an error if the source is missing */
  requireSource?: boolean;
  /** Whether to parse the selector as a query string */
  parseSelector?: boolean;
};

type ParseRangeReturnType<Opts extends ParseRangeOptions> =
  & ({params: Opts extends {requireBindings: true} ? querystring.ParsedUrlQuery : querystring.ParsedUrlQuery | null})
  & ({protocol: Opts extends {requireProtocol: true | string} ? string : string | null})
  & ({source: Opts extends {requireSource: true} ? string : string | null})
  & ({selector: Opts extends {parseSelector: true} ? querystring.ParsedUrlQuery : string});

const RANGE_REGEX = /^([^#:]*:)?((?:(?!::)[^#])*)(?:#((?:(?!::).)*))?(?:::(.*))?$/;

/**
 * Parses a range into its constituents. Ranges typically follow these forms,
 * with both `protocol` and `bindings` being optionals:
 *
 *     <protocol>:<selector>::<bindings>
 *     <protocol>:<source>#<selector>::<bindings>
 *
 * The selector is intended to "refine" the source, and is required. The source
 * itself is optional (for instance we don't need it for npm packages, but we
 * do for git dependencies).
 */
export function parseRange<Opts extends ParseRangeOptions>(range: string, opts?: Opts): ParseRangeReturnType<Opts> {
  const match = range.match(RANGE_REGEX);
  if (match === null)
    throw new Error(`Invalid range (${range})`);

  const protocol = typeof match[1] !== `undefined`
    ? match[1]
    : null;

  if (typeof opts?.requireProtocol === `string` && protocol !== opts!.requireProtocol)
    throw new Error(`Invalid protocol (${protocol})`);
  else if (opts?.requireProtocol && protocol === null)
    throw new Error(`Missing protocol (${protocol})`);

  const source = typeof match[3] !== `undefined`
    ? decodeURIComponent(match[2])
    : null;

  if (opts?.requireSource && source === null)
    throw new Error(`Missing source (${range})`);

  const rawSelector = typeof match[3] !== `undefined`
    ? decodeURIComponent(match[3])
    : decodeURIComponent(match[2]);

  const selector = (opts?.parseSelector)
    ? querystring.parse(rawSelector)
    : rawSelector;

  const params = typeof match[4] !== `undefined`
    ? querystring.parse(match[4])
    : null;

  return {
    // @ts-expect-error
    protocol,
    // @ts-expect-error
    source,
    // @ts-expect-error
    selector,
    // @ts-expect-error
    params,
  };
}

/**
 * Parses a range into its constituents. Ranges typically follow these forms,
 * with both `protocol` and `bindings` being optionals:
 *
 *     <protocol>:<selector>::<bindings>
 *     <protocol>:<source>#<selector>::<bindings>
 *
 * The selector is intended to "refine" the source, and is required. The source
 * itself is optional (for instance we don't need it for npm packages, but we
 * do for git dependencies).
 */
export function tryParseRange<Opts extends ParseRangeOptions>(range: string, opts?: Opts): ParseRangeReturnType<Opts> | null {
  try {
    return parseRange(range, opts);
  } catch {
    return null;
  }
}

/**
 * File-style ranges are bound to a parent locators that we need in order to
 * resolve relative paths to the location of their parent packages. This
 * function wraps `parseRange` to automatically extract the parent locator
 * from the bindings and return it along with the selector.
 */
export function parseFileStyleRange(range: string, {protocol}: {protocol: string}) {
  const {selector, params} = parseRange(range, {
    requireProtocol: protocol,
    requireBindings: true,
  });

  if (typeof params.locator !== `string`)
    throw new Error(`Assertion failed: Invalid bindings for ${range}`);

  const parentLocator = parseLocator(params.locator, true);
  const path = selector as PortablePath;

  return {parentLocator, path};
}

function encodeUnsafeCharacters(str: string) {
  str = str.replaceAll(`%`, `%25`);
  str = str.replaceAll(`:`, `%3A`);
  str = str.replaceAll(`#`, `%23`);
  return str;
}

function hasParams(params: querystring.ParsedUrlQuery | null): params is querystring.ParsedUrlQuery {
  if (params === null)
    return false;

  return Object.entries(params).length > 0;
}

/**
 * Turn the components returned by `parseRange` back into a string. Check
 * `parseRange` for more details.
 */
export function makeRange({protocol, source, selector, params}: {protocol: string | null, source: string | null, selector: string, params: querystring.ParsedUrlQuery | null}) {
  let range = ``;

  if (protocol !== null)
    range += `${protocol}`;
  if (source !== null)
    range += `${encodeUnsafeCharacters(source)}#`;

  range += encodeUnsafeCharacters(selector);

  if (hasParams(params))
    range += `::${querystring.stringify(params)}`;

  return range;
}

/**
 * Some bindings are internal-only and not meant to be displayed anywhere (for
 * instance that's the case with the parent locator bound to the `file:` ranges).
 *
 * this function strips them from a range.
 */
export function convertToManifestRange(range: string) {
  const {params, protocol, source, selector} = parseRange(range);

  for (const name in params)
    if (name.startsWith(`__`))
      delete params[name];

  return makeRange({protocol, source, params, selector});
}

/**
 * Returns a string from an ident (eg. `@types/lodash`).
 */
export function stringifyIdent(ident: Ident) {
  if (ident.scope) {
    return `@${ident.scope}/${ident.name}`;
  } else {
    return `${ident.name}`;
  }
}

/**
 * Returns a string from a descriptor (eg. `@types/lodash@^1.0.0`).
 */
export function stringifyDescriptor(descriptor: Descriptor) {
  if (descriptor.scope) {
    return `@${descriptor.scope}/${descriptor.name}@${descriptor.range}`;
  } else {
    return `${descriptor.name}@${descriptor.range}`;
  }
}

/**
 * Returns a string from a descriptor (eg. `@types/lodash@1.0.0`).
 */
export function stringifyLocator(locator: Locator) {
  if (locator.scope) {
    return `@${locator.scope}/${locator.name}@${locator.reference}`;
  } else {
    return `${locator.name}@${locator.reference}`;
  }
}

/**
 * Returns a string from an ident, formatted as a slug (eg. `@types-lodash`).
 */
export function slugifyIdent(ident: Ident) {
  if (ident.scope !== null) {
    return `@${ident.scope}-${ident.name}`;
  } else {
    return ident.name;
  }
}

const TRAILING_COLON_REGEX = /:$/;

/**
 * Returns a string from a locator, formatted as a slug (eg. `@types-lodash-npm-1.0.0-abcdef1234`).
 */
export function slugifyLocator(locator: Locator) {
  const {protocol, selector} = parseRange(locator.reference);

  const humanProtocol = protocol !== null
    ? protocol.replace(TRAILING_COLON_REGEX, ``)
    : `exotic`;

  const humanVersion = semver.valid(selector);

  const humanReference = humanVersion !== null
    ? `${humanProtocol}-${humanVersion}`
    : `${humanProtocol}`;

  // 10 hex characters means that 47 different entries have 10^-9 chances of
  // causing a hash collision. Since this hash is joined with the package name
  // (making it highly unlikely you'll have more than a handful of instances
  // of any single package), this should provide a good enough guard in most
  // cases.
  //
  // Also note that eCryptfs eats some bytes, so the theoretical maximum for a
  // file size is around 140 bytes (but we don't need as much, as explained).
  const hashTruncate = 10;

  const slug = locator.scope
    ? `${slugifyIdent(locator)}-${humanReference}-${locator.locatorHash.slice(0, hashTruncate)}`
    : `${slugifyIdent(locator)}-${humanReference}-${locator.locatorHash.slice(0, hashTruncate)}`;

  return slug as Filename;
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param ident The ident to pretty print
 */
export function prettyIdent(configuration: Configuration, ident: Ident): string {
  if (ident.scope) {
    return `${formatUtils.pretty(configuration, `@${ident.scope}/`, formatUtils.Type.SCOPE)}${formatUtils.pretty(configuration, ident.name, formatUtils.Type.NAME)}`;
  } else {
    return `${formatUtils.pretty(configuration, ident.name, formatUtils.Type.NAME)}`;
  }
}

const POST_QS_REGEX = /\?.*/;

function prettyRangeNoColors(range: string): string {
  if (range.startsWith(VIRTUAL_PROTOCOL)) {
    const nested = prettyRangeNoColors(range.substring(range.indexOf(`#`) + 1));
    const abbrev = range.substring(VIRTUAL_PROTOCOL.length, VIRTUAL_PROTOCOL.length + VIRTUAL_ABBREVIATE);

    // I'm not satisfied of how the virtual packages appear in the output

    // eslint-disable-next-line no-constant-condition
    return false ? `${nested} (virtual:${abbrev})` : `${nested} [${abbrev}]`;
  } else {
    return range.replace(POST_QS_REGEX, `?[...]`);
  }
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param ident The range to pretty print
 */
export function prettyRange(configuration: Configuration, range: string): string {
  return `${formatUtils.pretty(configuration, prettyRangeNoColors(range), formatUtils.Type.RANGE)}`;
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param descriptor The descriptor to pretty print
 */
export function prettyDescriptor(configuration: Configuration, descriptor: Descriptor): string {
  return `${prettyIdent(configuration, descriptor)}${formatUtils.pretty(configuration, `@`, formatUtils.Type.RANGE)}${prettyRange(configuration, descriptor.range)}`;
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param reference The reference to pretty print
 */
export function prettyReference(configuration: Configuration, reference: string) {
  return `${formatUtils.pretty(configuration, prettyRangeNoColors(reference), formatUtils.Type.REFERENCE)}`;
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param locator The locator to pretty print
 */
export function prettyLocator(configuration: Configuration, locator: Locator): string {
  return `${prettyIdent(configuration, locator)}${formatUtils.pretty(configuration, `@`, formatUtils.Type.REFERENCE)}${prettyReference(configuration, locator.reference)}`;
}

/**
 * Returns a string that is suitable to be printed to stdout. It will never
 * be colored.
 *
 * @param locator The locator to pretty print
 */
export function prettyLocatorNoColors(locator: Locator) {
  return `${stringifyIdent(locator)}@${prettyRangeNoColors(locator.reference)}`;
}

/**
 * Sorts a list of descriptors, first by their idents then by their ranges.
 */
export function sortDescriptors(descriptors: Iterable<Descriptor>) {
  return miscUtils.sortMap(descriptors, [
    descriptor => stringifyIdent(descriptor),
    descriptor => descriptor.range,
  ]);
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param workspace The workspace to pretty print
 */
export function prettyWorkspace(configuration: Configuration, workspace: Workspace) {
  return prettyIdent(configuration, workspace.anchoredLocator);
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param descriptor The descriptor to pretty print
 * @param locator The locator is resolves to
 */
export function prettyResolution(configuration: Configuration, descriptor: Descriptor, locator: Locator | null): string {
  const devirtualizedDescriptor = isVirtualDescriptor(descriptor)
    ? devirtualizeDescriptor(descriptor)
    : descriptor;

  if (locator === null) {
    return `${structUtils.prettyDescriptor(configuration, devirtualizedDescriptor)} → ${formatUtils.mark(configuration).Cross}`;
  } else if (devirtualizedDescriptor.identHash === locator.identHash) {
    return `${structUtils.prettyDescriptor(configuration, devirtualizedDescriptor)} → ${prettyReference(configuration, locator.reference)}`;
  } else {
    return `${structUtils.prettyDescriptor(configuration, devirtualizedDescriptor)} → ${prettyLocator(configuration, locator)}`;
  }
}

/**
 * Returns a string that is suitable to be printed to stdout. Based on the
 * configuration it may include color sequences.
 *
 * @param configuration Reference configuration
 * @param locator The locator to pretty print
 * @param descriptor The descriptor that depends on it
 */
export function prettyDependent(configuration: Configuration, locator: Locator, descriptor: Descriptor | null) {
  if (descriptor === null) {
    return `${prettyLocator(configuration, locator)}`;
  } else {
    return `${prettyLocator(configuration, locator)} (via ${structUtils.prettyRange(configuration, descriptor.range)})`;
  }
}

/**
 * The presence of a `node_modules` directory in the path is extremely common
 * in the JavaScript ecosystem to denote whether a path belongs to a vendor
 * or not. I considered using a more generic path for packages that aren't
 * always JS-only (such as when using the Git fetcher), but that unfortunately
 * caused various JS apps to start showing errors when working with git repos.
 *
 * As a result, all packages from all languages will follow this convention. At
 * least it'll be consistent, and linkers will always have the ability to remap
 * them to a different location if that's a critical requirement.
 */
export function getIdentVendorPath(ident: Ident) {
  return `node_modules/${stringifyIdent(ident)}` as PortablePath;
}

/**
 * Returns whether the given package is compatible with the specified environment.
 */
export function isPackageCompatible(pkg: Package, architectures: nodeUtils.ArchitectureSet) {
  if (!pkg.conditions)
    return true;

  return conditionParser(pkg.conditions, specifier => {
    const [, name, value] = specifier.match(CONDITION_REGEX)!;
    const supported = architectures[name as keyof typeof architectures];

    return supported ? supported.includes(value) : true;
  });
}

export function allPeerRequests(root: PeerRequestNode | PeerRequirementNode): Iterable<PeerRequestNode> {
  const requests = new Set<PeerRequestNode>();

  if (`children` in root) {
    requests.add(root);
  } else {
    for (const request of root.requests.values()) {
      requests.add(request);
    }
  }

  for (const request of requests) {
    for (const child of request.children.values()) {
      requests.add(child);
    }
  }

  return requests;
}
