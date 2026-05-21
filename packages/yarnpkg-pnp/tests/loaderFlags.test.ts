describe(`loaderFlags`, () => {
  const realNodeVersion = process.versions.node;

  const hasBrokenFstatForZipFds = (nodeVersion: string) => {
    Object.defineProperty(process.versions, `node`, {
      configurable: true,
      value: nodeVersion,
    });

    jest.resetModules();

    const loaderFlags: typeof import('../sources/esm-loader/loaderFlags') = require(`../sources/esm-loader/loaderFlags`);

    return loaderFlags.HAS_BROKEN_FSTAT_FOR_ZIP_FDS;
  };

  afterEach(() => {
    Object.defineProperty(process.versions, `node`, {
      configurable: true,
      value: realNodeVersion,
    });
  });

  describe(`HAS_BROKEN_FSTAT_FOR_ZIP_FDS`, () => {
    it(`should only include the affected v22.22 patch releases`, () => {
      expect(hasBrokenFstatForZipFds(`22.22.2`)).toBe(false);
      expect(hasBrokenFstatForZipFds(`22.22.3`)).toBe(true);
      expect(hasBrokenFstatForZipFds(`22.23.0`)).toBe(true);
    });

    it(`should keep the existing affected version ranges`, () => {
      expect(hasBrokenFstatForZipFds(`24.14.0`)).toBe(false);
      expect(hasBrokenFstatForZipFds(`24.15.0`)).toBe(true);
      expect(hasBrokenFstatForZipFds(`25.6.0`)).toBe(false);
      expect(hasBrokenFstatForZipFds(`25.7.0`)).toBe(true);
      expect(hasBrokenFstatForZipFds(`26.0.0`)).toBe(true);
      expect(hasBrokenFstatForZipFds(`26.1.0`)).toBe(false);
    });
  });
});
