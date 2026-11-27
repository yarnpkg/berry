describe(`Features`, () => {
  // provenance-downgrade@1.1.0 has a provenance attestation; 1.0.0 (older) and 1.2.0 (newer) don't
  describe(`npmTrustPolicyGate`, () => {
    test(
      `it should install the newest version when the gate is disabled`,
      makeTemporaryEnv({}, async ({run, source}) => {
        await run(`add`, `provenance-downgrade`);

        await expect(source(`require('provenance-downgrade/package.json')`)).resolves.toMatchObject({
          version: `1.2.0`,
        });
      }),
    );

    test(
      `it should skip a version that lost its provenance when resolving a tag`,
      makeTemporaryEnv({}, {
        npmTrustPolicyGate: true,
      }, async ({run, source}) => {
        await run(`add`, `provenance-downgrade`);

        await expect(source(`require('provenance-downgrade/package.json')`)).resolves.toMatchObject({
          version: `1.1.0`,
        });
      }),
    );

    test(
      `it should skip a version that lost its provenance when resolving a range`,
      makeTemporaryEnv({}, {
        npmTrustPolicyGate: true,
      }, async ({run, source}) => {
        await run(`add`, `provenance-downgrade@^1.0.0`);

        await expect(source(`require('provenance-downgrade/package.json')`)).resolves.toMatchObject({
          version: `1.1.0`,
        });
      }),
    );

    test(
      `it should refuse an exact version that lost its provenance`,
      makeTemporaryEnv({}, {
        npmTrustPolicyGate: true,
      }, async ({run}) => {
        await expect(run(`add`, `provenance-downgrade@1.2.0`)).rejects.toThrowError(`All versions satisfying "1.2.0" are quarantined`);
      }),
    );

    test(
      `it should allow a version published before any provenance existed`,
      makeTemporaryEnv({}, {
        npmTrustPolicyGate: true,
      }, async ({run, source}) => {
        await run(`add`, `provenance-downgrade@1.0.0`);

        await expect(source(`require('provenance-downgrade/package.json')`)).resolves.toMatchObject({
          version: `1.0.0`,
        });
      }),
    );

    test(
      `it should allow a downgraded version listed in npmPreapprovedPackages`,
      makeTemporaryEnv({}, {
        npmTrustPolicyGate: true,
        npmPreapprovedPackages: [`provenance-downgrade@1.2.0`],
      }, async ({run, source}) => {
        await run(`add`, `provenance-downgrade@^1.0.0`);

        await expect(source(`require('provenance-downgrade/package.json')`)).resolves.toMatchObject({
          version: `1.2.0`,
        });
      }),
    );
  });
});
