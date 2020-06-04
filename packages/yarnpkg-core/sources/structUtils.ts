import {PortablePath, toFilename}               from '@yarnpkg/fslib';
import querystring                              from 'querystring';
import semver                                   from 'semver';

import {Configuration, FormatType}              from './Configuration';
import {Workspace}                              from './Workspace';
import * as hashUtils                           from './hashUtils';
import * as miscUtils                           from './miscUtils';
import {IdentHash, DescriptorHash, LocatorHash} from './types';
import {Ident, Descriptor, Locator, Package}    from './types';

const VIRTUAL_PROTOCOL = `virtual:`;
const VIRTUAL_ABBREVIATE = 5;

export function makeIdent(scope: string | null, name: string): Ident {
  return {identHash: hashUtils.makeHash<IdentHash>(scope, name), scope, name};
}

export function makeDescriptor(ident: Ident, range: string): Descriptor {
  return {identHash: ident.identHash, scope: ident.scope, name: ident.name, descriptorHash: hashUtils.makeHash<DescriptorHash>(ident.identHash, range), range};
}

export function makeLocator(ident: Ident, reference: string): Locator {
  return {identHash: ident.identHash, scope: ident.scope, name: ident.name, locatorHash: hashUtils.makeHash<LocatorHash>(ident.identHash, reference), reference};
}

export function convertToIdent(source: Descriptor | Locator | Package): Ident {
  return {identHash: source.identHash, scope: source.scope, name: source.name};
}

export function convertDescriptorToLocator(descriptor: Descriptor): Locator {
  return {identHash: descriptor.identHash, scope: descriptor.scope, name: descriptor.name, locatorHash: descriptor.descriptorHash as unknown as LocatorHash, reference: descriptor.range};
}

export function convertLocatorToDescriptor(locator: Locator): Descriptor {
  return {identHash: locator.identHash, scope: locator.scope, name: locator.name, descriptorHash: locator.locatorHash as unknown as DescriptorHash, range: locator.reference};
}

export function convertPackageToLocator(pkg: Package): Locator {
  return {identHash: pkg.identHash, scope: pkg.scope, name: pkg.name, locatorHash: pkg.locatorHash, reference: pkg.reference};
}

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

    dependencies: new Map(pkg.dependencies),
    peerDependencies: new Map(pkg.peerDependencies),

    dependenciesMeta: new Map(pkg.dependenciesMeta),
    peerDependenciesMeta: new Map(pkg.peerDependenciesMeta),

    bin: new Map(pkg.bin),
  };
}

export function copyPackage(pkg: Package) {
  return renamePackage(pkg, pkg);
}

export function virtualizeDescriptor(descriptor: Descriptor, entropy: string): Descriptor {
  if (entropy.includes(`#`))
    throw new Error(`Invalid entropy`);

  return makeDescriptor(descriptor, `virtual:${entropy}#${descriptor.range}`);
}

export function virtualizePackage(pkg: Package, entropy: string): Package {
  if (entropy.includes(`#`))
    throw new Error(`Invalid entropy`);

  return renamePackage(pkg, makeLocator(pkg, `virtual:${entropy}#${pkg.reference}`));
}

export function isVirtualDescriptor(descriptor: Descriptor): boolean {
  return descriptor.range.startsWith(VIRTUAL_PROTOCOL);
}

export function isVirtualLocator(locator: Locator): boolean {
  return locator.reference.startsWith(VIRTUAL_PROTOCOL);
}

export function devirtualizeDescriptor(descriptor: Descriptor): Descriptor {
  if (!isVirtualDescriptor(descriptor))
    throw new Error(`Not a virtual descriptor`);

  return makeDescriptor(descriptor, descriptor.range.replace(/^[^#]*#/, ``));
}

export function devirtualizeLocator(locator: Locator): Locator {
  if (!isVirtualLocator(locator))
    throw new Error(`Not a virtual descriptor`);

  return makeLocator(locator, locator.reference.replace(/^[^#]*#/, ``));
}

export function bindDescriptor(descriptor: Descriptor, params: {[key: string]: string}) {
  if (descriptor.range.includes(`::`))
    return descriptor;

  return makeDescriptor(descriptor, `${descriptor.range}::${querystring.stringify(params)}`);
}

export function bindLocator(locator: Locator, params: {[key: string]: string}) {
  if (locator.reference.includes(`::`))
    return locator;

  return makeLocator(locator, `${locator.reference}::${querystring.stringify(params)}`);
}

export function areIdentsEqual(a: Ident, b: Ident) {
  return a.identHash === b.identHash;
}

export function areDescriptorsEqual(a: Descriptor, b: Descriptor) {
  return a.descriptorHash === b.descriptorHash;
}

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

export function parseIdent(string: string): Ident {
  const ident = tryParseIdent(string);
  if (!ident)
    throw new Error(`Invalid ident (${string})`);

  return ident;
}

export function tryParseIdent(string: string): Ident | null {
  const match = string.match(/^(?:@([^/]+?)\/)?([^/]+)$/);
  if (!match)
    return null;

  const [, scope, name] = match;

  const realScope = typeof scope !== `undefined`
    ? scope
    : null;

  return makeIdent(realScope, name);
}

export function parseDescriptor(string: string, strict: boolean = false): Descriptor {
  const descriptor = tryParseDescriptor(string, strict);
  if (!descriptor)
    throw new Error(`Invalid descriptor (${string})`);

  return descriptor;
}

export function tryParseDescriptor(string: string, strict: boolean = false): Descriptor | null {
  const match = strict
    ? string.match(/^(?:@([^/]+?)\/)?([^/]+?)(?:@(.+))$/)
    : string.match(/^(?:@([^/]+?)\/)?([^/]+?)(?:@(.+))?$/);

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

export function parseLocator(string: string, strict: boolean = false): Locator {
  const locator = tryParseLocator(string, strict);
  if (!locator)
    throw new Error(`Invalid locator (${string})`);

  return locator;
}

export function tryParseLocator(string: string, strict: boolean = false): Locator | null {
  const match = strict
    ? string.match(/^(?:@([^/]+?)\/)?([^/]+?)(?:@(.+))$/)
    : string.match(/^(?:@([^/]+?)\/)?([^/]+?)(?:@(.+))?$/);

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
  requireBindings?: boolean,
  requireProtocol?: boolean | string,
  requireSource?: boolean,
  parseSelector?: boolean,
};

type ParseRangeReturnType<Opts extends ParseRangeOptions> =
  & ({params: Opts extends {requireBindings: true} ? querystring.ParsedUrlQuery : querystring.ParsedUrlQuery | null})
  & ({protocol: Opts extends {requireProtocol: true | string} ? string : string | null})
  & ({source: Opts extends {requireSource: true} ? string : string | null})
  & ({selector: Opts extends {parseSelector: true} ? querystring.ParsedUrlQuery : string});

export function parseRange<Opts extends ParseRangeOptions>(range: string, opts?: Opts): ParseRangeReturnType<Opts> {
  const match = range.match(/^([^#:]*:)?((?:(?!::)[^#])*)(?:#((?:(?!::).)*))?(?:::(.*))?$/);
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
    // @ts-ignore
    protocol,
    // @ts-ignore
    source,
    // @ts-ignore
    selector,
    // @ts-ignore
    params,
  };
}

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
  str = str.replace(/%/g, `%25`);
  str = str.replace(/:/g, `%3A`);
  str = str.replace(/#/g, `%23`);
  return str;
}

function hasParams(params: querystring.ParsedUrlQuery | null): params is querystring.ParsedUrlQuery {
  if (params === null)
    return false;

  return Object.entries(params).length > 0;
}

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
 * The range used internally may differ from the range stored in the
 * Manifest (package.json). This removes any params indicated for internal use.
 * An internal param starts with "__".
 * @param range range to convert
 */
export function convertToManifestRange(range: string) {
  const {params, protocol, source, selector} = parseRange(range);

  for (const name in params)
    if (name.startsWith(`__`))
      delete params[name];

  return makeRange({protocol, source, params, selector});
}

export function requirableIdent(ident: Ident) {
  if (ident.scope) {
    return `@${ident.scope}/${ident.name}`;
  } else {
    return `${ident.name}`;
  }
}

export function stringifyIdent(ident: Ident) {
  if (ident.scope) {
    return `@${ident.scope}/${ident.name}`;
  } else {
    return `${ident.name}`;
  }
}

export function stringifyDescriptor(descriptor: Descriptor) {
  if (descriptor.scope) {
    return `@${descriptor.scope}/${descriptor.name}@${descriptor.range}`;
  } else {
    return `${descriptor.name}@${descriptor.range}`;
  }
}

export function stringifyLocator(locator: Locator) {
  if (locator.scope) {
    return `@${locator.scope}/${locator.name}@${locator.reference}`;
  } else {
    return `${locator.name}@${locator.reference}`;
  }
}

export function slugifyIdent(ident: Ident) {
  if (ident.scope !== null) {
    return `@${ident.scope}-${ident.name}`;
  } else {
    return ident.name;
  }
}

export function slugifyLocator(locator: Locator) {
  const {protocol, selector} = parseRange(locator.reference);

  const humanProtocol = protocol !== null
    ? protocol.replace(/:$/, ``)
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

  return toFilename(slug);
}

export function prettyIdent(configuration: Configuration, ident: Ident) {
  if (ident.scope) {
    return `${configuration.format(`@${ident.scope}/`, FormatType.SCOPE)}${configuration.format(ident.name, FormatType.NAME)}`;
  } else {
    return `${configuration.format(ident.name, FormatType.NAME)}`;
  }
}

function prettyRangeNoColors(range: string): string {
  if (range.startsWith(VIRTUAL_PROTOCOL)) {
    const nested = prettyRangeNoColors(range.substr(range.indexOf(`#`) + 1));
    const abbrev = range.substr(VIRTUAL_PROTOCOL.length, VIRTUAL_ABBREVIATE);

    // I'm not satisfied of how the virtual packages appear in the output

    // eslint-disable-next-line no-constant-condition
    return false ? `${nested} (virtual:${abbrev})` : `${nested} [${abbrev}]`;
  } else {
    return range.replace(/\?.*/, `?[...]`);
  }
}

export function prettyRange(configuration: Configuration, range: string) {
  return `${configuration.format(prettyRangeNoColors(range), FormatType.RANGE)}`;
}

export function prettyDescriptor(configuration: Configuration, descriptor: Descriptor) {
  return `${prettyIdent(configuration, descriptor)}${configuration.format(`@`, FormatType.RANGE)}${prettyRange(configuration, descriptor.range)}`;
}

export function prettyReference(configuration: Configuration, reference: string) {
  return `${configuration.format(prettyRangeNoColors(reference), FormatType.REFERENCE)}`;
}

export function prettyLocator(configuration: Configuration, locator: Locator) {
  return `${prettyIdent(configuration, locator)}${configuration.format(`@`, FormatType.REFERENCE)}${prettyReference(configuration, locator.reference)}`;
}

export function prettyLocatorNoColors(locator: Locator) {
  return `${stringifyIdent(locator)}@${prettyRangeNoColors(locator.reference)}`;
}

export function sortDescriptors(descriptors: Iterable<Descriptor>) {
  return miscUtils.sortMap(descriptors, [
    descriptor => stringifyIdent(descriptor),
    descriptor => descriptor.range,
  ]);
}

export function prettyWorkspace(configuration: Configuration, workspace: Workspace) {
  return prettyIdent(configuration, workspace.locator);
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
  return `node_modules/${requirableIdent(ident)}` as PortablePath;
}
