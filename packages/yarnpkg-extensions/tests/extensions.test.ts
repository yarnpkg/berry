import {packageExtensions} from '../sources/index';

describe(`packageExtensions`, () => {
  it(`should return entries`, () => {
    expect(packageExtensions.length).toBeGreaterThan(0);
  });
});
