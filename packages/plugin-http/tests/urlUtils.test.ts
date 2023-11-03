import * as urlUtils from '../sources/urlUtils';

const EXPECTATIONS: Array<[string, boolean]> = [
  [`https://example.org/package.tar.gz`, true],
  [`https://example.org/package.tgz`, true],
  [`https://example.org/package`, true],
  [`https://example.org/package.git`, false],
  [`https://example.org/package.tgz.git`, false],
  [`ftp://example.org/package.tgz`, false],
  [`1.2.3`, false],
];

for (const [url, expected] of EXPECTATIONS) {
  test(`isTgzUrl(${JSON.stringify(url)}) === ${JSON.stringify(expected)}`, () => {
    expect(urlUtils.isTgzUrl(url)).toEqual(expected);
  });
}
