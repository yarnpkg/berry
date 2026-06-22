import * as structUtils from '../sources/structUtils';

describe(`structUtils`, () => {
  describe(`makeIdent`, () => {
    it(`should return a unique slug string with scope`, () => {
      const slugA = structUtils.slugifyIdent(structUtils.makeIdent(`myscope`, `user-email`));
      expect(slugA).toEqual(`@myscope_user-email`);
      const slugB = structUtils.slugifyIdent(structUtils.makeIdent(`myscope-user`, `email`));
      expect(slugB).toEqual(`@myscope-user_email`);
      expect(slugA).not.toEqual(slugB);
    });
  });

  describe(`slugifyIdent`, () => {
    it(`should return a unique slug string with scope`, () => {
      const slugA = structUtils.slugifyIdent(structUtils.makeIdent(`myscope`, `user-email`));
      expect(slugA).toEqual(`@myscope_user-email`);
      const slugB = structUtils.slugifyIdent(structUtils.makeIdent(`myscope-user`, `email`));
      expect(slugB).toEqual(`@myscope-user_email`);
      expect(slugA).not.toEqual(slugB);
    });
  });
});
