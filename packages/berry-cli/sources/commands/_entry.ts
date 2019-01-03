import {resolve} from 'path';

export default (concierge: any) => concierge

  .command(`entry [... args]`)
  .describe(`select whether to use install or run`)
  .flags({proxyArguments: true, defaultCommand: true, hiddenCommand: true})

  .action(async ({version, args, stdout, ... env}: any) => {
    // berry --version
    if (args.length === 1 && args[0] === `--version`) {
      stdout.write(`v2.0.0\n`);
    
    // berry --frozen-lockfile
    } else if (args.length === 0 || args[0].charAt(0) === `-`) {
      return await concierge.run(null, [`install`, ... args], env);
    
    // berry ~/projects/foo install
    } else if (args.length !== 0 && args[0].charAt(0).match(/^(\.{1,2}(\/|$)|\/|([a-zA-Z]:)?\\\\)/)) {
      return await concierge.run(null, args.slice(1), {
        ... env,
        cwd: resolve(args[0]),
      });
    
    // berry start
    } else {
      return await concierge.run(null, [`run`, ... args], env);
    }
  });
