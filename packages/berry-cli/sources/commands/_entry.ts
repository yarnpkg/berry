export default (concierge: any) => concierge

  .command(`entry [... args]`)
  .describe(`select whether to use install or run`)
  .flags({proxyArguments: true, defaultCommand: true, hiddenCommand: true})

  .action(async ({version, args, stdout, ... env}: any) => {
    if (args.length === 1 && args[0] === `--version`) {
      stdout.write(`v2.0.0\n`);
    } else if (args.length === 0 || args[0].charAt(0) === `-`) {
      return await concierge.run(null, [`install`, ... args], env);
    } else {
      return await concierge.run(null, [`run`, ... args], env);
    }
  });
