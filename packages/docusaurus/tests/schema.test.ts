import Ajv2019         from 'ajv/dist/2019';
import draft2019Schema from 'ajv/dist/refs/json-schema-2019-09/schema.json';

import manifestSchema  from '../static/configuration/manifest.json';
import yarnRcSchema    from '../static/configuration/yarnrc.json';

const ajv = new Ajv2019();
const validate = ajv.compile(draft2019Schema);

describe(`manifest.json`, () => {
  it(`is a valid JSON Schema`, () => {
    const result = validate(manifestSchema);
    expect(validate.errors).toBeNull();
    expect(result).toBe(true);
  });
});

describe(`yarnrc.json`, () => {
  it(`is a valid JSON Schema`, () => {
    const result = validate(yarnRcSchema);
    expect(validate.errors).toBeNull();
    expect(result).toBe(true);
  });
});
