import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';
import chalk                         from 'chalk';
import cp                            from 'child_process';
import {Command, Option, runExit}    from 'clipanion';

const repoDir = ppath.dirname(npath.toPortablePath(__dirname));

runExit(class extends Command {
  branch = Option.String(`--branch`, `master`, {
    description: `The branch to use for the benchmark`,
  });

  async execute() {
    xfs.mktempSync(temp => {
      const nextEnv = {...process.env};

      nextEnv.YARN_IGNORE_PATH = `1`;
      nextEnv.NODE_OPTIONS = ``;

      function exec(arg0: string, argv: Array<string>, opts: cp.ExecFileSyncOptions) {
        try {
          cp.execFileSync(arg0, argv, {cwd: npath.fromPortablePath(temp), env: nextEnv, ...opts});
        } catch (err) {
          if (err.status !== 128) {
            throw err;
          }
        }
      }

      const binaryDir = ppath.join(temp, `bin`);
      xfs.mkdirSync(binaryDir);
      nextEnv.PATH = `${npath.fromPortablePath(binaryDir)}:${process.env.PATH}`;

      // We create two binary folders; each benchmark will use one or the other
      xfs.mkdirSync(ppath.join(binaryDir, `before`));
      xfs.symlinkSync(ppath.join(binaryDir, `yarn-before`), ppath.join(binaryDir, `before`, `yarn`));
      xfs.symlinkSync(ppath.join(repoDir, `packages/yarnpkg-cli/bundles/yarn.js`), ppath.join(binaryDir, `yarn-after`));

      xfs.mkdirSync(ppath.join(binaryDir, `after`));
      xfs.symlinkSync(ppath.join(binaryDir, `yarn-after`), ppath.join(binaryDir, `after`, `yarn`));

      // We create a few helper scripts to make the benchmarking easier
      xfs.writeFileSync(ppath.join(binaryDir, `yarn-repo`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(repoDir)}\n`,
        `unset YARN_IGNORE_PATH\n`,
        `export PATH="${process.env.PATH}"\n`,
        `exec yarn $@\n`,
      ].join(``));

      xfs.writeFileSync(ppath.join(binaryDir, `bench-commit`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `git add . && (git diff-index --quiet HEAD || git commit -m Commit > /dev/null)\n`,
      ].join(``));

      xfs.writeFileSync(ppath.join(binaryDir, `bench-import`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `jq -s '.[0] * .[1]' package.json ${npath.fromPortablePath(ppath.join(repoDir, `scripts/benchmarks`))}/$1.json > out.json\n`,
        `rm package.json\n`,
        `mv out.json package.json\n`,
      ].join(``));

      xfs.writeFileSync(ppath.join(binaryDir, `bench-reset`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `git reset --hard HEAD && git clean -fdx\n`,
      ].join(``));

      xfs.writeFileSync(ppath.join(binaryDir, `bench-run`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `\n`,
        `PATH="$(pwd)/bin/hyperfine:$PATH" hyperfine --warmup 1 \\\n`,
        `  --export-markdown=.git/yarn-bench \\\n`,
        `  --prepare 'bench-reset && bash "${npath.fromPortablePath(temp)}"/bench-prepare.sh' \\\n`,
        `  'before' \\\n`,
        `  'after'\n`,
        `\n`,
        // macOS
        `if which pbcopy >/dev/null 2>&1; then\n`,
        `  pbcopy < .git/yarn-bench\n`,
        // Linux
        `elif which xclip >/dev/null 2>&1; then\n`,
        `  xclip -selection clipboard < .git/yarn-bench\n`,
        `fi\n`,
      ].join(``));

      // We don't want Yarn to be called directly, since it'd be a global copy we don't control
      xfs.writeFileSync(ppath.join(binaryDir, `yarn`), [
        `#!/bin/bash\n`,
        `echo "Don't run Yarn directly:"\n`,
        `echo\n`,
        `echo "  - if the output is the same between both versions, use yarn-before or yarn-after instead"\n`,
        `echo "  - otherwise, add the call to the bench-prepare.sh script"\n`,
        `exit 1\n`,
      ].join(``));

      // We also create another binary dir, just to clean up the command line we show in Hyperfine
      xfs.mkdirSync(ppath.join(binaryDir, `hyperfine`));

      xfs.writeFileSync(ppath.join(binaryDir, `hyperfine/before`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `PATH="$(pwd)/bin/before:$PATH" bash bench-script.sh\n`,
      ].join(``));

      xfs.writeFileSync(ppath.join(binaryDir, `hyperfine/after`), [
        `#!/bin/bash\n`,
        `cd ${npath.fromPortablePath(temp)}\n`,
        `PATH="$(pwd)/bin/after:$PATH" bash bench-script.sh\n`,
      ].join(``));

      // Those two scripts are meant to be written by the user (but not run directly, so not executable and no shebang)
      xfs.writeFileSync(ppath.join(temp, `bench-prepare.sh`), ``);
      xfs.writeFileSync(ppath.join(temp, `bench-script.sh`), `yarn install\n`);

      // General Yarn configuration
      xfs.writeJsonSync(ppath.join(temp, Filename.rc), {
        globalFolder: `.yarn/global`,
      });

      xfs.writeJsonSync(ppath.join(temp, Filename.manifest), {
        name: `benchmark`,
        private: true,
      });

      // We retrieve the latest Yarn version from master, and add it to the PATH
      exec(`yarn-after`, [`set`, `version`, `from`, `sources`, `--branch=${this.branch}`], {stdio: `inherit`});

      const releaseFolder = ppath.join(temp, `.yarn/releases`);
      xfs.moveSync(ppath.join(releaseFolder, xfs.readdirSync(releaseFolder)[0]), ppath.join(binaryDir, `yarn-before`));

      // All binaries should be executable
      for (const name of xfs.readdirSync(binaryDir, {recursive: true}))
        xfs.chmodSync(ppath.join(binaryDir, name), 0o755);

      exec(`git`, [`init`], {stdio: `ignore`});
      exec(`git`, [`config`, `core.hooksPath`, npath.fromPortablePath(temp)], {stdio: `ignore`});
      exec(`git`, [`add`, `.`], {stdio: `ignore`});
      exec(`git`, [`commit`, `-m`, `First commit`, `--allow-empty`], {stdio: `ignore`});
      exec(`bench-commit`, [], {stdio: `ignore`});

      process.stdout.write(`\x1bc`);

      console.log(`You're now in the benchmarking environment. Here is how it works:`);
      console.log();
      console.log(`  - Setup the initial state of your repository, then run ${chalk.magenta(`bench-commit`)} to persist it in the temporary repository.`);
      console.log(`    (note that this repository intentionally lacks a gitignore - feel free to commit archives, metadata, etc)`);
      console.log(`  - If you want to run some code before the benchmark, add it to the ${chalk.yellow(`bench-prepare.sh`)} script in this folder.`);
      console.log(`  - By default the benchmark will run ${chalk.magenta(`yarn install`)}; you can change that by editing ${chalk.yellow(`bench-script.sh`)}.`);
      console.log(`  - When you want to run the benchmark, run ${chalk.magenta(`bench-run`)}. The repository will be reset between each run.`);
      console.log(`  - If using OSX or Linux, the results will be automatically copied to your clipboard. Otherwise, they'll be available in ${chalk.yellow(`.git/yarn-bench`)}.`);
      console.log();
      console.log(`Once you're done, exit the shell and the temporary environment will be removed.`);

      nextEnv.PS1 = `\\[\x1b[94m\\](Yarn benchmarking tool)\\[\x1b[39m\\] \\[\x1b[1m\\]$\\[\x1b[22m\\] `;
      nextEnv.PROMPT_COMMAND = `echo; trap 'echo; trap - DEBUG' DEBUG`;

      exec(`bash`, [], {stdio: `inherit`});
    });
  }
});
