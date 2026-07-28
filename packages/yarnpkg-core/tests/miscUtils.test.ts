import CJSON          from 'comment-json';

import * as miscUtils from '../sources/miscUtils';

describe(`miscUtils`, () => {
  describe(`replaceEnvVariables`, () => {
    it(`should replace environment variables with their values`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A}, VAR_B: \${VAR_B}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: ValueA, VAR_B: ValueB`);
    });

    it(`should use fallback when using the :- operator if environment variables are empty or unset`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-FallbackA}, VAR_B: \${VAR_B:-FallbackB}`,
          {
            env: {
              VAR_A: ``,
            },
          },
        ),
      ).toBe(`VAR_A: FallbackA, VAR_B: FallbackB`);
    });

    it(`should use fallback when using the - operator only if environment variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A-FallbackA}, VAR_B: \${VAR_B-FallbackB}`,
          {
            env: {
              VAR_A: ``,
            },
          },
        ),
      ).toBe(`VAR_A: , VAR_B: FallbackB`);
    });

    it(`should throw on unset environment variables without fallback`, () => {
      expect(() =>
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A}, VAR_B: \${VAR_B}`,
          {env: {}},
        ),
      ).toThrow();
    });

    it(`should throw on unclosed substitutions`, () => {
      expect(() =>
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A}, VAR_B: \${VAR_B`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toThrow();
    });

    it(`should throw on unknown operators`, () => {
      expect(() =>
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A}, VAR_B: \${VAR_B:+}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toThrow();
    });

    it(`should not replace escaped environment variables`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \\\${VAR_A}, VAR_B: \\\${VAR_B}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: \${VAR_A}, VAR_B: \${VAR_B}`);
    });

    it(`should treat escaped backslashes literally`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \\\\\${VAR_A}, VAR_B: \\\\\${VAR_B}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: \\ValueA, VAR_B: \\ValueB`);
    });

    it(`should treat escaped braces and unmatched braces literally`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\\}}, VAR_B: \${VAR_B}}`,
          {
            env: {
              VAR_A: ``,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: }, VAR_B: ValueB}`);
    });

    it(`should allow nested environment variables`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `\${VAR_A-\${VAR_B-\${VAR_C-fallback}}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
              VAR_C: `ValueC`,
            },
          },
        ),
      ).toBe(`ValueA`);
      expect(
        miscUtils.replaceEnvVariables(
          `\${VAR_X-\${VAR_B-\${VAR_C-fallback}}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
              VAR_C: `ValueC`,
            },
          },
        ),
      ).toBe(`ValueB`);
      expect(
        miscUtils.replaceEnvVariables(
          `\${VAR_X-\${VAR_Y-\${VAR_C-fallback}}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
              VAR_C: `ValueC`,
            },
          },
        ),
      ).toBe(`ValueC`);
      expect(
        miscUtils.replaceEnvVariables(
          `\${VAR_X-\${VAR_Y-\${VAR_Z-fallback}}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
              VAR_C: `ValueC`,
            },
          },
        ),
      ).toBe(`fallback`);
    });
  });

  describe(`mapAndFind`, () => {
    it(`should work with a simple example`, () => {
      expect(
        miscUtils.mapAndFind([1, 2, 3], n => {
          if (n !== 2)
            return miscUtils.mapAndFind.skip;

          return n;
        }),
      ).toEqual(2);
    });

    it(`should only return the first element that matches the predicate`, () => {
      expect(
        miscUtils.mapAndFind([`a`, 1, `b`, 2], n => {
          if (typeof n !== `number`)
            return miscUtils.mapAndFind.skip;

          return n;
        }),
      ).toEqual(1);
    });

    it(`should return undefined if no element matching the predicate is found`, () => {
      expect(
        miscUtils.mapAndFind([`a`, 1, `b`, 2], n => {
          if (typeof n !== `boolean`)
            return miscUtils.mapAndFind.skip;

          return n;
        }),
      ).toBeUndefined();
    });
  });

  describe(`isPathLike`, () => {
    it.each([
      `/some/abs/path`,
      `~/home/directory`,
      `../parent/directory`,
      `./current/directory`,
    ])(`should return true for %s`, pathLike => {
      expect(miscUtils.isPathLike(pathLike)).toBe(true);
    });

    it.each([
      `{some-glob,}`,
      `pkg-a`,
      `@scope/ident`,
      `scope/ident`,
      `~`,
    ])(`should return false for %s`, pathLike => {
      expect(miscUtils.isPathLike(pathLike)).toBe(false);
    });
  });

  describe(`toMerged`, () => {
    it(`should merge 2 shallow objects without mutating any arguments`, () => {
      const a = {a: 1};
      const b = {b: 2};
      const c = miscUtils.toMerged(a, b);

      expect(a).toStrictEqual({a: 1});
      expect(b).toStrictEqual({b: 2});
      expect(c).toStrictEqual({a: 1, b: 2});
    });

    it(`should merge 2 deep objects without mutating any arguments`, () => {
      const a = {n: {a: 1}};
      const b = {n: {b: 2}};
      const c = miscUtils.toMerged(a, b);

      expect(a).toStrictEqual({n: {a: 1}});
      expect(b).toStrictEqual({n: {b: 2}});
      expect(c).toStrictEqual({n: {a: 1, b: 2}});
    });

    it(`should merge 2 arrays by concatenating their contents without mutating any arguments`, () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      const c = miscUtils.toMerged(a, b);

      expect(a).toStrictEqual([1, 2, 3]);
      expect(b).toStrictEqual([4, 5, 6]);
      expect(c).toStrictEqual([1, 2, 3, 4, 5, 6]);
    });

    it(`should merge 2 objects of arrays by concatenating their contents without mutating any arguments`, () => {
      const a = {n: [1, 2, 3]};
      const b = {n: [4, 5, 6]};
      const c = miscUtils.toMerged(a, b);

      expect(a).toStrictEqual({n: [1, 2, 3]});
      expect(b).toStrictEqual({n: [4, 5, 6]});
      expect(c).toStrictEqual({n: [1, 2, 3, 4, 5, 6]});
    });

    it(`should merge identical elements in arrays (primitives)`, () => {
      const a = {n: [1, 2, 3, 4]};
      const b = {n: [4, 5, 6]};
      const c = miscUtils.toMerged(a, b);

      expect(c).toStrictEqual({n: [1, 2, 3, 4, 5, 6]});
    });

    it(`should merge identical elements in arrays (objects)`, () => {
      const a = {n: [{a: 1}, {b: 2}]};
      const b = {n: [{b: 2}, {c: 3}]};
      const c = miscUtils.toMerged(a, b);

      expect(c).toStrictEqual({n: [{a: 1}, {b: 2}, {c: 3}]});
    });
  });

  describe(`mergeIntoTarget`, () => {
    it(`should preserve comments when the target is an object created by comment-json`, () => {
      const a = CJSON.parse(`{
        // n
        "n":
        // array
        [
          // 1
          1,
          // 2
          2,
          // 3
          3
        ]
      }`);
      const b = {n: [4, 5, 6]};
      const c = miscUtils.mergeIntoTarget(a, b);

      expect(CJSON.stringify(c, null, 2)).toStrictEqual(
        CJSON.stringify(
          CJSON.parse(`{
        // n
        "n":
        // array
        [
          // 1
          1,
          // 2
          2,
          // 3
          3,
          4,
          5,
          6
        ]
      }`),
          null,
          2,
        ),
      );
    });
  });
});
