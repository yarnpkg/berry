import execa = require('execa');

import {Configuration}      from '@berry/core';
import {Readable, Writable} from 'stream';

import {plugins}            from '../plugins';

export default (concierge: any) => concierge

  .command(`node [... args]`)
  .describe(`run node with the hook already setup`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);

    await execa(`node`, [`-r`, configuration.pnpPath, ... args], {
      stdin, stdout, stderr
    });
  });
