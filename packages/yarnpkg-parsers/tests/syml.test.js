import {parseSyml}                                     from '@yarnpkg/parsers';
import fs                                              from 'fs';
import { performance }                                 from 'perf_hooks';
import {safeLoad as parseWithJsYaml, FAILSAFE_SCHEMA}  from 'js-yaml';
import {parse as parseWithYaml }                       from 'yaml';

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

describe('Yaml parse comparison (to be removed / reworked)', () => {
  it(`should parse identically as js-yaml@3`, () => {

    const lock = fs.readFileSync(`${__dirname}/../../../yarn.lock`, `utf8`);

    // js-yaml@3 doesn't parse `key: true` as a boolean, but as a string.
    // as far as I tested it makes the lock file invalid after install.
    const reviver = (key, value) => {
      if (value === true) {
        return 'true';
      } else if (value === false) {
        return 'false';
      }
      return value;
    }

    const startJsYaml = performance.now();
    const jsYamlParsed = parseWithJsYaml(lock, {schema: FAILSAFE_SCHEMA});
    const endJsYaml = performance.now();
    const jsYamlTime = endJsYaml - startJsYaml;

    const startYaml = performance.now();
    const yamlParsed = parseWithYaml(lock, reviver, {
      uniqueKeys: false,
      schema: 'failsafe',
      customTags: []
    })
    const endYaml = performance.now();
    const yamlTime = endYaml - startYaml;

    expect(yamlParsed).toStrictEqual(jsYamlParsed);
    expect(yamlTime).toBeLessThan(jsYamlTime);
  })
})
