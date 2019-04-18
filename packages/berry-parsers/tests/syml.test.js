import {parseSyml} from '@berry/parsers';

describe(`Syml parser`, () => {
  it(`shouldn't confuse old-style values with new-style keys`, () => {
    expect(parseSyml(`foo "C:\\\\foobar"\n`)).toEqual({
      foo: `C:\\foobar`,
    });
  });
});
