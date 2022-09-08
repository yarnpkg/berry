import {parseSyml} from '@yarnpkg/parsers';

describe(`Syml parser`, () => {
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

  it(`should parse double quoted scalars`, () => {
    expect(parseSyml(`"foo"`)).toStrictEqual(`foo`);
  });

  it(`should parse empty double quoted scalars`, () => {
    expect(parseSyml(`""`)).toStrictEqual(``);
  });

  it(`should parse single quoted scalars`, () => {
    expect(parseSyml(`'foo'`)).toStrictEqual(`foo`);
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

  it(`should parse flow sequences with mixed scalar items`, () => {
    expect(parseSyml(`[foo, "bar"]`)).toStrictEqual([`foo`, `bar`]);
  });
});
