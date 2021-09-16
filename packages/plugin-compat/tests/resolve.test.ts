import path    from 'path';
import resolve from 'resolve';

const FILENAME = path.basename(__filename);

describe(`ResolvePatch`, () => {
  it(`should not match a local file that matches the specifier`, () => {
    expect(() =>
      resolve.sync(FILENAME, {extensions: [`.ts`]}),
    ).toThrow(`Cannot find module '${FILENAME}'`);

    expect(
      () => resolve.sync(FILENAME, {
        extensions: [`.ts`],
        __skipPackageIterator: true,
      } as any),
    ).toThrow(`Cannot find module '${FILENAME}'`);
  });

  it(`should match a local file when using the paths option`, () => {
    expect(
      resolve.sync(FILENAME, {
        paths: [__dirname],
        extensions: [`.ts`],
      }),
    ).toEqual(__filename);

    expect(
      resolve.sync(FILENAME, {
        paths: [__dirname],
        extensions: [`.ts`],
        __skipPackageIterator: true,
      } as any),
    ).toEqual(__filename);
  });

  it(`can require dependency in paths`, () => {
    expect(
      resolve.sync(`got`, {
        paths: [require.resolve(`@yarnpkg/core`)],
      }),
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));

    expect(
      resolve.sync(`got`, {
        paths: [require.resolve(`@yarnpkg/core`)],
        __skipPackageIterator: true,
      } as any),
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));
  });
});
