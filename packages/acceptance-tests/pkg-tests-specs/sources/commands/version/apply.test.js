describe(`Commands`, () => {
  describe(`version apply`, () => {
    test(
      `fails if the next version isn't a valid semver`,
      makeTemporaryEnv(
        {
          'version:next': '^2.0.0-rc.0',
          name: '@scope/test',
        },
        async ({path, run}) => {
          await expect(run(`version`, `apply`)).rejects.toThrow(`UsageError: @scope/test@workspace:.: Can't apply the version bump if the resulting version (^2.0.0-rc.0) isn't valid semver`);
        }
      )
    );
  });
});
