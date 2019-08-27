describe(`Commands`, () => {
  describe(`version apply`, () => {
    test(
      `fails if the next version isn't a valid semver`,
      makeTemporaryEnv(
        {
          nextVersion: {
            semver: '^2.0.0-rc.0',
            nonce: '1',
          },
          name: '@scope/test',
        },
        async ({path, run}) => {
          await expect(run(`version`, `apply`)).rejects.toThrow(`UsageError: Can't apply the version bump if the resulting version (^2.0.0-rc.0) isn't valid semver (in @scope/test@workspace:.)`);
        }
      )
    );
  });
});
