import {xfs} from '../sources';

describe(`xfs`, () => {
  describe(`detachTemp`, () => {
    it(`should detach temp created by mktempSync`, async () => {
      const temp = xfs.mktempSync();
      xfs.detachTemp(temp);

      const otherTemp = xfs.mktempSync(t => {
        xfs.detachTemp(t);
        return t;
      });

      xfs.rmtempSync();

      await expect(xfs.existsPromise(temp)).resolves.toBe(true);
      await expect(xfs.existsPromise(otherTemp)).resolves.toBe(true);
    });

    it(`should detach temp created by mktempPromise`, async () => {
      const temp = await xfs.mktempPromise();
      xfs.detachTemp(temp);

      const otherTemp = await xfs.mktempPromise(async t => {
        xfs.detachTemp(t);
        return t;
      });

      xfs.rmtempPromise();

      await expect(xfs.existsPromise(temp)).resolves.toBe(true);
      await expect(xfs.existsPromise(otherTemp)).resolves.toBe(true);
    });
  });
});
