const pathToRepo = path.join(execEnv.tempDir, `repo`);
const pathToSubpackage = path.join(pathToRepo, `packages/remark-shiki-twoslash`);
const pathToArchive = path.join(pathToSubpackage, `remark-shiki-twoslash-3.0.4.tgz`);

// Clone the repository
child_process.execFileSync(`git`, [`clone`, `--depth=1`, `--branch`, `mael/env-typo`, `git@github.com:arcanis/twoslash`, pathToRepo], {stdio: `inherit`});

// Install the dependencies
child_process.execFileSync(`pnpm`, [`install`], {stdio: `inherit`, cwd: pathToRepo});
child_process.execFileSync(`pnpm`, [`bootstrap`], {stdio: `inherit`, cwd: pathToRepo});

// Pack a specific workspace
child_process.execFileSync(`pnpm`, [`pack`], {stdio: `inherit`, cwd: pathToSubpackage});

// Send the package content into the build directory
child_process.execFileSync(`tar`, [`-x`, `-z`, `--strip-components=1`, `-f`, pathToArchive, `-C`, execEnv.buildDir], {stdio: `inherit`});
