import * as miscUtils from '../sources/miscUtils';

describe(`miscUtils`, () => {
  describe(`mapAndFind`, () => {
    it(`should work with a simple example`, () => {
      expect(
        miscUtils.mapAndFind([1, 2, 3], n => {
          if (n !== 2)
            return miscUtils.mapAndFind.skip;

          return n;
        })
      ).toEqual(2);
    });

    it(`should only return the first element that matches the predicate`, () => {
      expect(
        miscUtils.mapAndFind([`a`, 1, `b`, 2], n => {
          if (typeof n !== `number`)
            return miscUtils.mapAndFind.skip;

          return n;
        })
      ).toEqual(1);
    });

    it(`should return undefined if no element matching the predicate is found`, () => {
      expect(
        miscUtils.mapAndFind([`a`, 1, `b`, 2], n => {
          if (typeof n !== `boolean`)
            return miscUtils.mapAndFind.skip;

          return n;
        })
      ).toBeUndefined();
    });
  });
});
