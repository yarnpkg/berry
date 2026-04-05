import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {execFileSync}                    from 'child_process';

function getDefaultTestBinary() {
  const candidates: Array<PortablePath> = [
    ppath.join(npath.toPortablePath(__dirname), `../../../../../scripts/run-yarn.js` as PortablePath),
    ppath.join(npath.toPortablePath(__dirname), `../../../../yarnpkg-cli/bundles/yarn.js` as PortablePath),
    ppath.join(npath.toPortablePath(__dirname), `../../../../yarnpkg-cli/bin/yarn.js` as PortablePath),
    ppath.join(npath.toPortablePath(__dirname), `../../../../berry-cli/bin/berry.js` as PortablePath),
  ];

  const found = candidates.find(candidate => xfs.existsSync(candidate));
  if (typeof found === `undefined`)
    throw new Error(`No suitable Yarn binary was found (tried: ${candidates.map(candidate => npath.fromPortablePath(candidate)).join(`, `)})`);

  return npath.fromPortablePath(found);
}

const initialTestBinary = process.env.TEST_BINARY;

beforeAll(() => {
  if (typeof initialTestBinary === `undefined`) {
    process.env.TEST_BINARY = getDefaultTestBinary();
  }
});

afterAll(() => {
  if (typeof initialTestBinary === `undefined`) {
    delete process.env.TEST_BINARY;
  } else {
    process.env.TEST_BINARY = initialTestBinary;
  }
});

describe(`Commands`, () => {
  describe(`completions`, () => {
    test(
      `it should print a bash completion script including the yarn binary and common commands`,
      makeTemporaryEnv({}, async ({path, run}) => {
        await run(`install`);

        const {stdout} = await run(`completions`, `bash`);

        expect(stdout).toContain(`_yarn_completions`);
        expect(stdout).toContain(`complete -o default -F _yarn_completions yarn`);
        expect(stdout).toContain(`__yarn_get_children()`);
        expect(stdout).toContain(`__yarn_get_options()`);
        expect(stdout).not.toContain(`declare -A`);
        expect(stdout).not.toContain(`declare -gA`);

        let hasBash = false;
        try {
          execFileSync(`bash`, [`--version`], {stdio: `ignore`});
          hasBash = true;
        } catch {
          hasBash = false;
        }

        if (hasBash) {
          const completionFile = ppath.join(path, `yarn.completions.bash` as PortablePath);
          await xfs.writeFilePromise(completionFile, stdout, `utf8`);

          const completionFileNative = npath.fromPortablePath(completionFile);

          {
            const out = execFileSync(`bash`, [`-c`, [
              `source "${completionFileNative}"`,
              `COMP_WORDS=(yarn --cwd test-cwd "")`,
              `COMP_CWORD=3`,
              `_yarn_completions`,
              `printf '%s\\n' "\${COMPREPLY[@]}"`,
            ].join(`\n`)], {encoding: `utf8`});
            expect(out.split(/\n/)).toContain(`add`);
          }

          {
            const out = execFileSync(`bash`, [`-c`, [
              `source "${completionFileNative}"`,
              `COMP_WORDS=(yarn --cwd "")`,
              `COMP_CWORD=2`,
              `_yarn_completions`,
              `printf '%s\\n' "\${COMPREPLY[@]}"`,
            ].join(`\n`)], {encoding: `utf8`});
            expect(out.trim()).toBe(``);
          }

          {
            const out = execFileSync(`bash`, [`-c`, [
              `source "${completionFileNative}"`,
              `COMP_WORDS=(yarn completions "")`,
              `COMP_CWORD=2`,
              `_yarn_completions`,
              `printf '%s\\n' "\${COMPREPLY[@]}"`,
            ].join(`\n`)], {encoding: `utf8`});
            expect(out.split(/\n/)).toContain(`bash`);
          }
        }
      }),
    );

    test(
      `it should install the completion script under the XDG data directory when requested`,
      makeTemporaryEnv({}, async ({path, run}) => {
        const dataHome: PortablePath = ppath.join(path, `xdg-data`);
        const target = ppath.join(dataHome, `yarn/completions/yarn.bash`);

        await run(`install`);

        await run(`completions`, `bash`, `--install`, `--yes`, {
          env: {
            XDG_DATA_HOME: npath.fromPortablePath(dataHome),
          },
        });

        expect(xfs.existsSync(target)).toBe(true);

        const content = await xfs.readFilePromise(target, `utf8`);
        expect(content).toContain(`_yarn_completions`);
        expect(content).toContain(`complete -o default -F _yarn_completions yarn`);
      }),
    );

    test(
      `it should use a consistent key encoding for fish and powershell multi-word commands`,
      makeTemporaryEnv({}, async ({run}) => {
        await run(`install`);

        const {stdout: fishStdout} = await run(`completions`, `fish`);

        expect(fishStdout).toContain(`case "set version from"`);
        expect(fishStdout).toContain(`echo sources`);
        expect(fishStdout).toContain(`set -l key (string join " " $cmd_tokens)`);

        const {stdout: powerShellStdout} = await run(`completions`, `powershell`);

        expect(powerShellStdout).toContain(`"set_version_from" = @('sources')`);
        expect(powerShellStdout).toContain(`-join ' '`);
      }),
    );
  });
});
