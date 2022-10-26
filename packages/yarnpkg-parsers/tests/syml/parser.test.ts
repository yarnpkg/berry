import {parseSyml} from '@yarnpkg/parsers';

import {joinYaml}  from '../utils';

// TODO: Update the terminology used in this file to match the way it's used in the YAML spec.

describe(`Syml parser`, () => {
  describe(`Errors`, () => {
    it(`should hide implementation details from the error stack`, () => {
      try {
        parseSyml(`@foo`);
      } catch (error) {
        // toThrow doesn't seem to work for matching anything but the message (even when specifying the fields)
        expect(error.stack).not.toMatch(/wasm/);
      }

      expect.assertions(1);
    });
  });

  describe(`Lockfile tests`, () => {
    describe(`Modern`, () => {
      it(`should parse new-style objects`, () => {
        expect(parseSyml(`foo:\n  bar: true\n  baz: "quux"\n`)).toEqual({
          foo: {bar: `true`, baz: `quux`},
        });
      });

      it(`should merge duplicates resulting from merge conflicts`, () => {
        expect(
          parseSyml(joinYaml([
            `"lodash@npm:^4.17.20":`,
            `  version: 4.17.20`,
            ``,
            `"lodash@npm:^4.17.20":`,
            `  version: 4.17.20`,
          ]), {overwriteDuplicateEntries: true}),
        ).toEqual({'lodash@npm:^4.17.20': {version: `4.17.20`}});
      });
    });

    describe(`Legacy`, () => {
      it(`should parse old-style objects`, () => {
        expect(parseSyml(`# yarn lockfile v1\nfoo:\n  bar true\n  baz "quux"\n`)).toEqual({
          foo: {bar: true, baz: `quux`},
        });
      });

      it(`shouldn't confuse old-style values with new-style keys`, () => {
        expect(parseSyml(`# yarn lockfile v1\nfoo "C:\\\\foobar"\n`)).toEqual({
          foo: `C:\\foobar`,
        });
      });
    });
  });

  // TODO: Check the error messages.
  describe(`Duplicate mapping entries`, () => {
    describe(`Default behavior`, () => {
      it(`should throw on duplicate entries in flow mappings`, () => {
        expect(() => parseSyml(`{foo: bar, foo: baz}`)).toThrow();
      });

      it(`should throw on duplicate entries in compact block mappings`, () => {
        expect(() => parseSyml(joinYaml([
          `foo: bar`,
          `foo: baz`,
        ]))).toThrow();
      });

      it(`should throw on duplicate entries in block mappings`, () => {
        expect(() => parseSyml(joinYaml([
          `foo:`,
          `  bar: baz`,
          `  bar: qux`,
        ]))).toThrow();
      });
    });

    describe(`overwriteDuplicates: true`, () => {
      it(`should overwrite duplicate entries in flow mappings`, () => {
        expect(parseSyml(`{foo: bar, foo: baz}`, {overwriteDuplicateEntries: true})).toStrictEqual({foo: `baz`});
      });

      it(`should overwrite duplicate entries in compact block mappings`, () => {
        expect(parseSyml(joinYaml([
          `foo: bar`,
          `foo: baz`,
        ]), {overwriteDuplicateEntries: true})).toStrictEqual({foo: `baz`});
      });

      it(`should overwrite duplicate entries in block mappings`, () => {
        expect(parseSyml(joinYaml([
          `foo:`,
          `  bar: baz`,
          `  bar: qux`,
        ]), {overwriteDuplicateEntries: true})).toStrictEqual({foo: {bar: `qux`}});
      });
    });
  });

  describe(`Non-values`, () => {
    it(`should parse empty strings as an empty object`, () => {
      expect(parseSyml(``)).toStrictEqual({});
    });

    it(`should parse whitespace-only strings as an empty object`, () => {
      expect(parseSyml(`\n \t \n`)).toStrictEqual({});
    });
  });

  it(`should parse plain scalars`, () => {
    expect(parseSyml(`foo`)).toStrictEqual(`foo`);
  });

  it(`should parse plain scalars containing single quotes`, () => {
    expect(parseSyml(`foo'bar'baz''qux'`)).toStrictEqual(`foo'bar'baz''qux'`);
  });

  it(`should parse double quoted scalars`, () => {
    expect(parseSyml(`"foo"`)).toStrictEqual(`foo`);
  });

  it(`should parse empty double quoted scalars`, () => {
    expect(parseSyml(`""`)).toStrictEqual(``);
  });

  it(`should parse single quoted scalars`, () => {
    expect(parseSyml(`'foo'`)).toStrictEqual(`foo`);
  });

  it(`should parse empty single quoted scalars`, () => {
    expect(parseSyml(`''`)).toStrictEqual(``);
  });

  it(`should parse single quoted scalars with escaped single quotes`, () => {
    expect(parseSyml(`'a''b'`)).toStrictEqual(`a'b`);
  });

  it(`should parse empty flow mappings`, () => {
    expect(parseSyml(`{}`)).toStrictEqual({});
  });

  it(`should parse flow mappings with plain scalar entries`, () => {
    expect(parseSyml(`{foo: bar}`)).toStrictEqual({foo: `bar`});
    expect(parseSyml(`{foo: bar, baz: qux}`)).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should parse flow mappings with double quoted scalar entries`, () => {
    expect(parseSyml(`{"foo": "bar"}`)).toStrictEqual({foo: `bar`});
    expect(parseSyml(`{"foo": "bar", "baz": "qux"}`)).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should parse flow mappings with single quoted scalar entries`, () => {
    expect(parseSyml(`{'foo': 'bar'}`)).toStrictEqual({foo: `bar`});
    expect(parseSyml(`{'foo': 'bar', 'baz': 'qux'}`)).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should parse flow mappings with flow mapping entries`, () => {
    expect(parseSyml(`{ foo: { bar: a } }`)).toStrictEqual({foo: {bar: `a`}});
    expect(parseSyml(`{ foo: { bar: { baz: a } } }`)).toStrictEqual({foo: {bar: {baz: `a`}}});
    expect(parseSyml(`{ foo: { bar: a }, baz: { qux: b } }`)).toStrictEqual({foo: {bar: `a`}, baz: {qux: `b`}});
  });

  it(`should parse flow mappings with flow sequence entries`, () => {
    expect(parseSyml(`{foo: [bar], baz: [qux]}`)).toStrictEqual({foo: [`bar`], baz: [`qux`]});
  });

  it(`should allow whitespace inside flow mappings`, () => {
    expect(parseSyml(joinYaml([
      `{  `,
      `     }`,
    ]))).toStrictEqual({});

    expect(parseSyml(joinYaml([
      `{   \t `,
      `     foo:  \t  bar  \t  `,
      ` \t ,  \t `,
      `   \t  baz: qux  \t `,
      ` \t }`,
    ]))).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should allow trailing commas inside flow mappings`, () => {
    expect(parseSyml(joinYaml([
      `{`,
      `  foo: bar,`,
      `  baz: qux,`,
      `}`,
    ]))).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should parse empty flow sequences`, () => {
    expect(parseSyml(`[]`)).toStrictEqual([]);
  });

  it(`should parse flow sequences with plain scalar items`, () => {
    expect(parseSyml(`[foo]`)).toStrictEqual([`foo`]);
    expect(parseSyml(`[foo, bar]`)).toStrictEqual([`foo`, `bar`]);
  });

  it(`should parse flow sequences with double quoted scalar items`, () => {
    expect(parseSyml(`["foo"]`)).toStrictEqual([`foo`]);
    expect(parseSyml(`["foo", "bar"]`)).toStrictEqual([`foo`, `bar`]);
  });

  it(`should parse flow sequences with single quoted scalar items`, () => {
    expect(parseSyml(`['foo']`)).toStrictEqual([`foo`]);
    expect(parseSyml(`['foo', 'bar']`)).toStrictEqual([`foo`, `bar`]);
  });

  it(`should parse flow sequences with mixed scalar items`, () => {
    expect(parseSyml(`[foo, "bar", 'baz']`)).toStrictEqual([`foo`, `bar`, `baz`]);
  });

  it(`should parse flow sequences with flow sequence items`, () => {
    expect(parseSyml(`[[foo]]`)).toStrictEqual([[`foo`]]);
    expect(parseSyml(`[[[foo]]]`)).toStrictEqual([[[`foo`]]]);
    expect(parseSyml(`[[foo, bar], [baz]]`)).toStrictEqual([[`foo`, `bar`], [`baz`]]);
  });

  it(`should parse flow sequences with flow mapping items`, () => {
    expect(parseSyml(`[{foo: bar}]`)).toStrictEqual([{foo: `bar`}]);
    expect(parseSyml(`[{foo: bar}, {baz: qux}]`)).toStrictEqual([{foo: `bar`}, {baz: `qux`}]);
  });

  it(`should parse flow sequences with compact flow mapping items`, () => {
    expect(parseSyml(`[foo: bar]`)).toStrictEqual([{foo: `bar`}]);
    expect(parseSyml(`[foo: bar, baz: qux]`)).toStrictEqual([{foo: `bar`}, {baz: `qux`}]);
  });

  it(`should allow whitespace inside flow sequences`, () => {
    expect(parseSyml(joinYaml([
      `[  `,
      `     ]`,
    ]))).toStrictEqual([]);

    expect(parseSyml(joinYaml([
      `[   \t `,
      `     foo  \t  `,
      ` \t ,  \t `,
      `   \t  bar  \t `,
      ` \t ]`,
    ]))).toStrictEqual([`foo`, `bar`]);
  });

  it(`should allow trailing commas inside flow sequences`, () => {
    expect(parseSyml(joinYaml([
      `[`,
      `  foo,`,
      `  bar,`,
      `]`,
    ]))).toStrictEqual([`foo`, `bar`]);
  });

  it(`should parse compact block mappings`, () => {
    expect(parseSyml(joinYaml([
      `foo: bar`,
    ]))).toStrictEqual({foo: `bar`});

    expect(parseSyml(joinYaml([
      `foo: bar`,
      `baz: qux`,
    ]))).toStrictEqual({foo: `bar`, baz: `qux`});
  });

  it(`should parse block mappings`, () => {
    expect(parseSyml(joinYaml([
      `foo:`,
      `  bar: baz`,
    ]))).toStrictEqual({foo: {bar: `baz`}});

    expect(parseSyml(joinYaml([
      `foo:`,
      `  bar: baz`,
      `  a: b`,
    ]))).toStrictEqual({foo: {bar: `baz`, a: `b`}});
  });

  it(`should parse block mappings with block sequence entries`, () => {
    expect(parseSyml(joinYaml([
      `foo:`,
      `  - bar`,
    ]))).toStrictEqual({foo: [`bar`]});

    expect(parseSyml(joinYaml([
      `foo:`,
      `  - bar`,
      `  - baz`,
    ]))).toStrictEqual({foo: [`bar`, `baz`]});
  });

  it(`should parse block sequences`, () => {
    expect(parseSyml(joinYaml([
      `- foo`,
    ]))).toStrictEqual([`foo`]);

    expect(parseSyml(joinYaml([
      `- foo`,
      `- bar`,
    ]))).toStrictEqual([`foo`, `bar`]);
  });

  it(`should parse block sequences with compact block mapping items`, () => {
    expect(parseSyml(joinYaml([
      `- foo: bar`,
    ]))).toStrictEqual([{foo: `bar`}]);

    expect(parseSyml(joinYaml([
      `- foo: bar`,
      `- baz: qux`,
    ]))).toStrictEqual([{foo: `bar`}, {baz: `qux`}]);
  });

  it(`should parse block sequences with block mapping items`, () => {
    expect(parseSyml(joinYaml([
      `- foo: bar`,
      `  baz: qux`,
    ]))).toStrictEqual([{foo: `bar`, baz: `qux`}]);

    expect(parseSyml(joinYaml([
      `- foo: bar`,
      `  baz: qux`,
      `- a: b`,
      `  c: d`,
    ]))).toStrictEqual([{foo: `bar`, baz: `qux`}, {a: `b`, c: `d`}]);
  });

  it(`should parse block sequences with nested block mapping items`, () => {
    expect(parseSyml(joinYaml([
      `- foo:`,
      `    bar:`,
      `      baz: qux`,
    ]))).toStrictEqual([{foo: {bar: {baz: `qux`}}}]);
  });

  it(`should parse block sequences with block sequence items`, () => {
    expect(parseSyml(joinYaml([
      `- - foo`,
    ]))).toStrictEqual([[`foo`]]);

    expect(parseSyml(joinYaml([
      `- - foo`,
      `- - bar`,
    ]))).toStrictEqual([[`foo`], [`bar`]]);

    expect(parseSyml(joinYaml([
      `- - foo`,
      `  - bar`,
      `- - baz`,
      `  - qux`,
    ]))).toStrictEqual([[`foo`, `bar`], [`baz`, `qux`]]);
  });

  it(`should parse weirdly indented block expressions`, () => {
    expect(parseSyml(joinYaml([
      `  a:`,
      `      b:`,
      `       c: d`,
      `       e: f`,
      `      g:`,
      `      - h`,
      `      - i: j`,
      `        k: l`,
      `        m:`,
      `         n:`,
      `           o:`,
      `             p: q`,
      `      - r`,
      `  s:`,
      `     -   - t`,
      `         - u`,
      `     -      - v`,
      `     - - w: x`,
      `     -     -    -    y`,
      `     -   -   -    -   -  z`,
      `  1:`,
      `  - 2:`,
      `      - 3:`,
      `        -   -   -   -   -   -   -   -   -   -  4: 5`,
      `                                               6: 7`,
      `                                               8:`,
      `                                                  9: 10`,
      `                                            - 11: 12`,
      `                                            - 13`,
    ]))).toStrictEqual({
      a: {
        b: {
          c: `d`,
          e: `f`,
        },
        g: [
          `h`,
          {
            i: `j`,
            k: `l`,
            m: {n: {o: {p: `q`}}},
          },
          `r`,
        ],
      },
      s: [
        [`t`, `u`],
        [`v`],
        [{w: `x`}],
        [[`y`]],
        [[[[`z`]]]],
      ],
      1: [{
        2: [{
          3: [[[[[[[[[[
            {
              4: `5`,
              6: `7`,
              8: {9: `10`},
            },
            {11: `12`},
            `13`,
          ]]]]]]]]]],
        }],
      }],
    });
  });

  it(`should parse weirdly indented block expressions with leading and trailing comments and line endings`, () => {
    expect(parseSyml(joinYaml([
      ``,
      `# 1`,
      `  # 2`,
      `    # 3`,
      ``,
      `  foo: bar`,
      ``,
      `# 4`,
      `  # 5`,
      `    # 6`,
      ``,
    ]))).toStrictEqual({foo: `bar`});

    expect(parseSyml(joinYaml([
      ``,
      `# 1`,
      `  # 2`,
      `    # 3`,
      ``,
      `  - foo`,
      ``,
      `# 4`,
      `  # 5`,
      `    # 6`,
      ``,
    ]))).toStrictEqual([`foo`]);
  });
});
