import {structUtils} from '@yarnpkg/core';
import {PortablePath} from '@yarnpkg/fslib';

import {makeDescriptor, parseDescriptor} from '../sources/patchUtils';

const ident = structUtils.makeIdent(null, `is-number`);
const source = structUtils.makeDescriptor(ident, `npm:7.0.0`);

describe(`patch paths`, () => {
  it(`should keep an ampersand inside a patch path`, () => {
    const made = makeDescriptor(ident, {
      parentLocator: null,
      sourceDescriptor: source,
      patchPaths: [`~/patches/r&d/is-number.patch` as PortablePath],
    });

    expect(made.range.includes(`r&d`)).toBe(false);
    expect(parseDescriptor(made).patchPaths).toEqual([
      `~/patches/r&d/is-number.patch`,
    ]);
  });

  it(`should read a percent-encoded ampersand from a hand-written range`, () => {
    const descriptor = structUtils.makeDescriptor(ident, `patch:is-number@npm%3A7.0.0#~/patches/r%26d/is-number.patch`);

    expect(parseDescriptor(descriptor).patchPaths).toEqual([
      `~/patches/r&d/is-number.patch`,
    ]);
  });

  it(`should still split two patch paths when one contains an ampersand`, () => {
    const made = makeDescriptor(ident, {
      parentLocator: null,
      sourceDescriptor: source,
      patchPaths: [`a.patch` as PortablePath, `b&c.patch` as PortablePath],
    });

    expect(parseDescriptor(made).patchPaths).toEqual([`a.patch`, `b&c.patch`]);
  });

  it(`should keep a percent sign in a patch path`, () => {
    const made = makeDescriptor(ident, {
      parentLocator: null,
      sourceDescriptor: source,
      patchPaths: [`100%done.patch` as PortablePath],
    });

    expect(parseDescriptor(made).patchPaths).toEqual([`100%done.patch`]);
  });
});
