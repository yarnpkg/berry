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

  it(`can require a dependency from paths`, () => {
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

  it(`can require a dependency from basedir`, () => {
    expect(
      resolve.sync(`got`, {
        basedir: require.resolve(`@yarnpkg/core`),
      }),
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));

    expect(
      resolve.sync(`got`, {
        basedir: require.resolve(`@yarnpkg/core`),
        __skipPackageIterator: true,
      } as any),
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));
  });

  it(`non-absolute paths should return non-absolute result if it can be found from the cwd`, () => {
    // This test covers https://github.com/yarnpkg/berry/issues/897
    // The behaviour is odd but the patch shouldn't change it
    // The cwd when this test runs is the repo root
    expect(
      resolve.sync(`run-yarn.js`, {
        paths: [`scripts`],
      }),
    ).toEqual(`scripts${path.sep}run-yarn.js`);

    expect(
      resolve.sync(`run-yarn.js`, {
        paths: [`scripts`],
        __skipPackageIterator: true,
      } as any),
    ).toEqual(`scripts${path.sep}run-yarn.js`);
  });
});
