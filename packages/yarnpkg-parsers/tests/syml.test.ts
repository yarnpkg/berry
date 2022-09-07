import {parseSyml} from '@yarnpkg/parsers';

describe(`Syml parser`, () => {
  it(`should parse plain string scalars`, () => {
    expect(parseSyml(`foo`)).toStrictEqual(`foo`);
  });
});
