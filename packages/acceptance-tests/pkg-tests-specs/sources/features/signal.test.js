const {xfs} = require(`@yarnpkg/fslib`);

describe(`SIGTERM`, () => {
  test(
    `yarn exec should end child script on SIGTERM`,
    makeTemporaryEnv({
      scripts: {
        sleep: `node -e "console.log('Testing script SIGTERM'); setTimeout(() => {}, 100000)"`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      await xfs.writeFilePromise(`${path}/test.sh`, ([
        `yarn sleep &`,
        `sleep 1`,
        `ps | grep -v "grep" | grep -q "Testing script SIGTERM" || exit 1`, // check if it was started properly
        `kill $!`,
        `sleep 1`,
        `if ps | grep -v "grep" | grep -q "Testing script SIGTERM"`,
        `then`,
        `  echo "[FAIL] still running"; exit 1`,
        `else`,
        `  echo "[PASS] ok"; exit 0`,
        `fi`,
      ]).join(`\n`));

      await expect(run(`exec`, `bash`, `test.sh`)).resolves.toMatchObject({
        code: 0,
        stdout: expect.stringContaining(`PASS`),
      });
    })
  );

  test(
    `yarn exec script should end child process on SIGTERM`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/test.sh`, ([
        `yarn node -e "console.log('Testing exec SIGTERM'); setTimeout(() => {}, 10000)" &`,
        `sleep 1`,
        `ps | grep -v "grep" | grep -q "Testing exec SIGTERM" || exit 1`, // check if it was started properly
        `kill $!`,
        `sleep 1`,
        `if ps | grep -v "grep" | grep -q "Testing exec SIGTERM"`,
        `then`,
        `  echo "[FAIL] still running"; exit 1`,
        `else`,
        `  echo "[PASS] ok"; exit 0`,
        `fi`,
      ]).join(`\n`));

      await expect(run(`exec`, `bash`, `test.sh`)).resolves.toMatchObject({
        code: 0,
        stdout: expect.stringContaining(`PASS`),
      });
    })
  );
});
