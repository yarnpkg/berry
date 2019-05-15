import {NodeFS, ppath} from '@berry/fslib';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any) => clipanion

  .command(`entry [... args]`)
  .describe(`select whether to use install or run`)
  .flags({proxyArguments: true, defaultCommand: true, hiddenCommand: true})

  .action(async ({cwd, version, args, stdout, ... env}: any) => {
    // berry --version
    if (args.length === 1 && args[0] === `--version`) {
      stdout.write(`v2.0.0\n`);

    // berry --help
    } else if (args.length === 1 && (args[0] === `--help` || args[0] === `-h`)) {
      clipanion.usage(env.argv0, {stream: stdout});

    // berry --frozen-lockfile
    } else if (args.length === 0 || args[0].charAt(0) === `-`) {
      return await clipanion.run(null, [`install`, ... args], {cwd, stdout, ... env});

    // berry ~/projects/foo install
    } else if (args.length !== 0 && args[0].match(/[\\\/]/)) {
      const newCwd = ppath.resolve(cwd, NodeFS.toPortablePath(args[0]));
      return await clipanion.run(null, args.slice(1), {cwd: newCwd, stdout, ... env});

    // berry start
    } else {
      return await clipanion.run(null, [`run`, ... args], {cwd, stdout, ... env});
    }
  });
