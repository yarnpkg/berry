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

    it(`should use empty strings when environment variables are empty strings`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A-FallbackA}, VAR_B: \${VAR_B-FallbackB}`,
          {
            env: {
              VAR_A: ``,
              VAR_B: ``,
            },
          },
        ),
      ).toBe(`VAR_A: , VAR_B: `);
    });

    it(`should use fallback values when environment variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-FallbackA}, VAR_B: \${VAR_B:-FallbackB}`,
          {env: {}},
        ),
      ).toBe(`VAR_A: FallbackA, VAR_B: FallbackB`);
    });

    it(`should use fallback values when environment variables are empty strings`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-FallbackA}, VAR_B: \${VAR_B:-FallbackB}`,
          {
            env: {
              VAR_A: ``,
              VAR_B: ``,
            },
          },
        ),
      ).toBe(`VAR_A: FallbackA, VAR_B: FallbackB`);
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

    it(`should replace primary environment variables with their values when there is 1 step of nesting`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A-\${VAR_A2-FallbackA}}, VAR_B: \${VAR_B-\${VAR_B2-FallbackB}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: ValueA, VAR_B: ValueB`);
    });

    it(`should use empty strings when primary environment variables are empty strings when there is 1 step of nesting`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A-\${VAR_A2-FallbackA}}, VAR_B: \${VAR_B-\${VAR_B2-FallbackB}}`,
          {
            env: {
              VAR_A: ``,
              VAR_B: ``,
            },
          },
        ),
      ).toBe(`VAR_A: , VAR_B: `);
    });

    it(`should replace primary environment variables with their values when there is 1 step of nesting`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\${VAR_A2:-FallbackA}}, VAR_B: \${VAR_B:-\${VAR_B2:-FallbackB}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: ValueA, VAR_B: ValueB`);
    });

    it(`should replace secondary environment variables with their values when primary variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\${VAR_A2:-FallbackA}}, VAR_B: \${VAR_B:-\${VAR_B2:-FallbackB}}`,
          {
            env: {
              VAR_A2: `ValueA2`,
              VAR_B2: `ValueB2`,
            },
          },
        ),
      ).toBe(`VAR_A: ValueA2, VAR_B: ValueB2`);
    });

    it(`should use fallback values when primary and secondary variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\${VAR_A2:-FallbackA}}, VAR_B: \${VAR_B:-\${VAR_B2:-FallbackB}}`,
          {env: {}},
        ),
      ).toBe(`VAR_A: FallbackA, VAR_B: FallbackB`);
    });

    it(`should not replace escaped primary environment variables`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \\\${VAR_A:-\${VAR_A2:-FallbackA}}, VAR_B: \\\${VAR_B:-\${VAR_B2:-FallbackB}}`,
          {
            env: {
              VAR_A: `ValueA`,
              VAR_B: `ValueB`,
            },
          },
        ),
      ).toBe(`VAR_A: \${VAR_A:-\${VAR_A2:-FallbackA}}, VAR_B: \${VAR_B:-\${VAR_B2:-FallbackB}}`);
    });

    it(`should not replace escaped secondary environment variables`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\\\${VAR_A2:-FallbackA}}, VAR_B: \${VAR_B:-\\\${VAR_B2:-FallbackB}}`,
          {
            env: {
              VAR_A2: `ValueA2`,
              VAR_B2: `ValueB2`,
            },
          },
        ),
      ).toBe(`VAR_A: \${VAR_A2:-FallbackA}, VAR_B: \${VAR_B2:-FallbackB}`);
    });

    it(`should replace tertiary environment variables with their values when primary and secondary variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\${VAR_A2:-\${VAR_A3:-FallbackA}}}, VAR_B: \${VAR_B:-\${VAR_B2:-\${VAR_B3:-FallbackB}}}`,
          {
            env: {
              VAR_A3: `ValueA3`,
              VAR_B3: `ValueB3`,
            },
          },
        ),
      ).toBe(`VAR_A: ValueA3, VAR_B: ValueB3`);
    });

    it(`should use fallback values when primary, secondary and tertiary variables are not set`, () => {
      expect(
        miscUtils.replaceEnvVariables(
          `VAR_A: \${VAR_A:-\${VAR_A2:-\${VAR_A3:-FallbackA}}}, VAR_B: \${VAR_B:-\${VAR_B2:-\${VAR_B3:-FallbackB}}}`,
          {env: {}},
        ),
      ).toBe(`VAR_A: FallbackA, VAR_B: FallbackB`);
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
