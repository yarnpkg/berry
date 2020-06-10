import path    from 'path';
import resolve from 'resolve';

describe(`ResolvePatch`, () => {
  it(`works on local file`, () => {
    expect(
      resolve.sync(path.basename(__filename), {extensions: [`.ts`]})
    ).toEqual(__filename);

    expect(
      resolve.sync(path.basename(__filename), {
        extensions: [`.ts`],
        __skipPackageIterator: true,
      } as any)
    ).toEqual(__filename);
  });

  it(`works on local file with paths option`, () => {
    expect(
      resolve.sync(`extensions.ts`, {
        paths: [path.join(__dirname, `../sources`)],
        extensions: [`.ts`],
      })
    ).toEqual(path.join(__dirname, `../sources/extensions.ts`));

    expect(
      resolve.sync(`extensions.ts`, {
        paths: [path.join(__dirname, `../sources`)],
        extensions: [`.ts`],
        __skipPackageIterator: true,
      } as any)
    ).toEqual(path.join(__dirname, `../sources/extensions.ts`));
  });

  it(`can require dependency in paths`, () => {
    expect(
      resolve.sync(`got`, {
        paths: [require.resolve(`@yarnpkg/core`)],
      })
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));

    expect(
      resolve.sync(`got`, {
        paths: [require.resolve(`@yarnpkg/core`)],
        __skipPackageIterator: true,
      } as any)
    ).toEqual(require.resolve(`got`, {paths: [require.resolve(`@yarnpkg/core`)]}));
  });
});
