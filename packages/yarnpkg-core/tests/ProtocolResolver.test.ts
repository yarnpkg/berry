import {TAG_REGEXP} from "../sources/ProtocolResolver";

describe(`ProtocolResolver`, () => {
  describe(`TAG_REGEXP`, () => {
    const validTags = [
      `canary`,
      `latest`,
      `next`,
      `legacy_v1`,
    ];

    it(`should allow all valid tags`, () => {
      const badTags = validTags.filter(tag => !TAG_REGEXP.test(tag));
      expect(badTags.length).toBe(0);
    });
  });
});
