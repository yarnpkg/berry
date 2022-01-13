import {generatePrettyJson} from '../sources/generatePrettyJson';

describe(`Pretty JSON`, () => {
  it(`should not add trailing comma for undefined value`, () => {
    const output = generatePrettyJson({
      foo: `asd`,
      bar: undefined,
    });

    expect(() => JSON.parse(output)).not.toThrowError();
  });
});
