const {
  exec: {execFile},
  fs: {readFile, writeJson},
} = require('pkg-tests-core');

describe(`Features`, () => {
  describe(`Merge Conflict Resolution`, () => {
    test(
      `it should properly fix merge conflicts`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await execFile(`git`, [`init`], {cwd: path});
          await execFile(`git`, [`config`, `user.email`, `you@example.com`], {cwd: path});
          await execFile(`git`, [`config`, `user.name`, `Your Name`], {cwd: path});

          await run(`install`);
          await writeJson(`${path}/package.json`, {dependencies:{[`no-deps`]: `*`}});

          await execFile(`git`, [`add`, `-A`], {cwd: path});
          await execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await execFile(`git`, [`checkout`, `master`], {cwd: path});
          await execFile(`git`, [`checkout`, `-b`, `1.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `1.0.0`);
          await execFile(`git`, [`add`, `-A`], {cwd: path});
          await execFile(`git`, [`commit`, `-a`, `-m`, `commit-1.0.0`], {cwd: path});

          await execFile(`git`, [`checkout`, `master`], {cwd: path});
          await execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `2.0.0`);
          await execFile(`git`, [`add`, `-A`], {cwd: path});
          await execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await execFile(`git`, [`checkout`, `master`], {cwd: path});
          await execFile(`git`, [`merge`, `1.0.0`], {cwd: path});

          await expect(execFile(`git`, [`merge`, `2.0.0`], {cwd: path})).rejects.toThrow(/CONFLICT/);

          let lockfile = await readFile(`${path}/yarn.lock`, `utf8`);
          lockfile = lockfile.replace(/(checksum: ).*/g, `$1<checksum stripped>`);

          await expect(lockfile).toMatchSnapshot();
          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );
  });
});
