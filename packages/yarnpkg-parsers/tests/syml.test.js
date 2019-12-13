import {parseSyml} from '@yarnpkg/parsers';

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
});
