import {parseSyml, stringifySyml} from '@yarnpkg/parsers';

describe(`Syml parser`, () => {
  it(`shouldn't confuse old-style values with new-style keys`, () => {
    expect(parseSyml(`# yarn lockfile v1\nfoo "C:\\\\foobar"\n`)).toEqual({
      foo: `C:\\foobar`,
    });
  });

  it(`should parse new-style objects`, () => {
    expect(parseSyml(`foo:\n  bar: true\n  baz: "quux"\n`)).toEqual({
      foo: {bar: `true`, baz: `quux`},
    });
  });

  it(`should parse old-style objects`, () => {
    expect(parseSyml(`# yarn lockfile v1\nfoo:\n  bar true\n  baz "quux"\n`)).toEqual({
      foo: {bar: `true`, baz: `quux`},
    });
  });

  it(`should merge duplicates`, () => {
    expect(
      parseSyml(`
      "lodash@npm:^4.17.20":
        version: 4.17.20

      "lodash@npm:^4.17.20":
        version: 4.17.20
      `),
    ).toEqual({'lodash@npm:^4.17.20': {version: `4.17.20`}});
  });
});

describe(`Syml stringifyer`, () => {
  it(`stringifies an object`, () => {
    expect(stringifySyml({foo: {bar: `true`, baz: `quux`}})).toEqual(`foo:\n  bar: true\n  baz: quux\n`);
  });

  it(`stringifies an object with a long key with yaml 1.2 spec`, () => {
    const longKey = `a`.repeat(1025); // long key is a string of length > 1024
    expect(stringifySyml({[longKey]: {bar: `true`, baz: `quux`}})).toEqual(`? ${longKey}\n:\n  bar: true\n  baz: quux\n`);
    expect(stringifySyml({[longKey]: {[longKey]: `quux`, baz: `quux`}})).toEqual(`? ${longKey}\n:\n  ? ${longKey}\n  : quux\n  baz: quux\n`);
    expect(stringifySyml({[longKey]: {[longKey]: {aa: `quux`, [longKey]: `zip`}, baz: `zax`}})).toEqual(`? ${longKey}\n:\n  ? ${longKey}\n  :\n    aa: quux\n    ? ${longKey}\n    : zip\n  baz: zax\n`);
  });
});
