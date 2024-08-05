import * as pnpUtils from '../sources/pnpUtils';

describe(`pnpUtils`, () => {
  describe(`cleanNodeOptions`, () => {
    const PNP_PATH_ARGS = {
      ...Object.fromEntries(Object.entries({
        [`filename`]: `.pnp.cjs`,
        [`absolute posix path`]: `/path/to/.pnp.cjs`,
        [`relative posix path`]: `../path/to/.pnp.cjs`,
        [`absolute windows path`]: `C:\\Path\\To\\.pnp.cjs`,
        [`relative windows path`]: `..\\path\\to\\.pnp.cjs`,

        [`UNC windows path (\\\\[server]\\[sharename]\\)`]: `\\\\Server01\\user\\docs\\.pnp.cjs`,
        [`long UNC windows path (\\\\?\\[server]\\[sharename]\\)`]: `\\\\?\\Server01\\user\\docs\\.pnp.cjs`,
        [`long UNC windows path (\\\\?\\UNC\\[server]\\[sharename]\\)`]: `\\\\?\\UNC\\Server01\\user\\docs\\.pnp.cjs`,
        [`long UNC windows path (\\\\?\\[drive_spec]:\\)`]: `\\\\?\\C:\\user\\docs\\.pnp.cjs`,
        [`long UNC windows path with dot (\\\\.\\[physical_device]\\)`]: `\\\\.\\PhysicalDevice\\user\\docs\\.pnp.cjs`,
      }).flatMap(([k, v]) => [
        [k, v],
        [`double quoted ${k}`, `"${v}"`],
      ])),

      [`double quoted absolute posix path with spaces`]: `"/path/  t     o  /.pnp.cjs"`,
      [`double quoted absolute windows path with spaces`]: `"C:\\Path\\  T     o  \\.pnp.cjs"`,

      [`old hook filename`]: `.pnp.js`,
    };

    for (const [description, pnpPath] of Object.entries(PNP_PATH_ARGS)) {
      it(`should remove PnP hook requires (${description})`, () => {
        expect(pnpUtils.cleanNodeOptions(`--require ${pnpPath}`)).toStrictEqual(``);
        expect(pnpUtils.cleanNodeOptions(`--require=${pnpPath}`)).toStrictEqual(``);
        expect(pnpUtils.cleanNodeOptions(`-r ${pnpPath}`)).toStrictEqual(``);
      });
    }

    it(`should support double quotes in any part of the argument`, () => {
      // These are all supported by Node
      expect(pnpUtils.cleanNodeOptions(`--require=".pnp.cjs"`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`"--require=.pnp.cjs"`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`"--require"=.pnp.cjs`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`"--require=".pnp.cjs`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`"--require"=".pnp.cjs"`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`"--require="".pnp.cjs"`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`""-""-""r""e""q""u""i""r""e""="".""p""n""p"".""c""j""s""`)).toStrictEqual(``);
    });

    it(`should support escaping double quotes using a backslash`, () => {
      expect(pnpUtils.cleanNodeOptions(`--require="/path/t\\"o/.pnp.cjs" --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
    });

    it(`should support escaping a backslash using a backslash`, () => {
      expect(pnpUtils.cleanNodeOptions(`--require="/path/t\\\\"o/.pnp.cjs --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
      expect(pnpUtils.cleanNodeOptions(`--require="/path/t\\\\\\"o/.pnp.cjs" --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
      expect(pnpUtils.cleanNodeOptions(`--require="/path/t\\\\\\\\"o/.pnp.cjs --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
      expect(pnpUtils.cleanNodeOptions(`--require="/path/t\\\\\\\\\\"o/.pnp.cjs" --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
    });

    it(`should recognize characters even when escaped via a backslash`, () => {
      expect(pnpUtils.cleanNodeOptions(`--require="\\/\\p\\a\\t\\h\\/\\t\\o\\/\\.\\p\\n\\p\\.\\c\\j\\s" --max-http-header-size="100000"`)).toStrictEqual(`--max-http-header-size="100000"`);
    });

    it(`shouldn't remove arguments between 2 PnP hook requires`, () => {
      expect(pnpUtils.cleanNodeOptions(`--require "C:\\foo\\.pnp.cjs" --foo="true" --require foo.bar.pnp.cjs`)).toStrictEqual(`--foo="true"`);
    });

    it(`shouldn't remove PnP hook requires inside other arguments`, () => {
      expect(pnpUtils.cleanNodeOptions(`--require "C:\\foo\\.pnp.cjs" --report-dir "C:\\foo\\bar\\--require .pnp.cjs"`)).toStrictEqual(`--report-dir "C:\\foo\\bar\\--require .pnp.cjs"`);
    });

    it(`should remove PnP experimental loaders`, () => {
      expect(pnpUtils.cleanNodeOptions(`--experimental-loader .pnp.loader.mjs`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`--experimental-loader /path/to/.pnp.loader.mjs`)).toStrictEqual(``);
      expect(pnpUtils.cleanNodeOptions(`--experimental-loader C:\\Path\\To\\.pnp.loader.mjs`)).toStrictEqual(``);
    });
  });
});
