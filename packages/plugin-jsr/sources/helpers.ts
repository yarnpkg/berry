import {Descriptor, Locator, semverUtils} from '@yarnpkg/core';
import {structUtils}                      from '@yarnpkg/core';

export function convertDescriptorFromJsrToNpm(dependency: Descriptor) {
  const rangeWithoutProtocol = dependency.range.slice(4);

  if (semverUtils.validRange(rangeWithoutProtocol))
    return structUtils.makeDescriptor(dependency, `npm:${structUtils.stringifyIdent(structUtils.wrapIdentIntoScope(dependency, `jsr`))}@${rangeWithoutProtocol}`);

  const parsedRange = structUtils.tryParseDescriptor(rangeWithoutProtocol, true);
  if (parsedRange !== null)
    return structUtils.makeDescriptor(dependency, `npm:${structUtils.stringifyIdent(structUtils.wrapIdentIntoScope(parsedRange, `jsr`))}@${parsedRange.range}`);

  throw new Error(`Invalid range: ${dependency.range}`);
}

export function convertLocatorFromJsrToNpm(locator: Locator) {
  return structUtils.makeLocator(structUtils.wrapIdentIntoScope(locator, `jsr`), `npm:${locator.reference.slice(4)}`);
}

export function convertLocatorFromNpmToJsr(locator: Locator) {
  return structUtils.makeLocator(structUtils.unwrapIdentFromScope(locator, `jsr`), `jsr:${locator.reference.slice(4)}`);
}
