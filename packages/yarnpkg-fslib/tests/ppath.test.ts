import {ppath} from '../sources/path';

describe(`Portable paths`, () => {
  describe(`resolve`, () => {
    it(`should use platform-specific resolution`, () => {
      const path = ppath.resolve(process.cwd(), `sub-dir`);
      expect(path.startsWith(`/`)).toBe(process.platform !== `win32`);
    });
  });
});
