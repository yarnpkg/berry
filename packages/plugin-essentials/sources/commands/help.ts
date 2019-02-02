export default (concierge: any) => concierge

  .command(`help [command]`)
  .describe(`print the program usage`)

  .action(async ({command, ... rest}: {command: string | null, rest: {[key: string]: any}}) => {
    if (command) {
      return await concierge.run(null, [command, `-h`], rest);
    } else {
      return await concierge.run(null, [`-h`], rest);
    }
  });
