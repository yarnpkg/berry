import execa = require('execa');

import {Configuration} from '@berry/core';
import {Stream}        from 'stream';

import {plugins}       from '../plugins';

export default (concierge: any) => concierge

  .command(`node [... args]`)
  .describe(`run node with the hook setup`)
  .flags({proxyArguments: true})

  .action(async ({stdin, stdout, stderr, args}: {stdin: Stream, stdout: Stream, stderr: Stream, args: Array<string>}) => {
    const configuration = await Configuration.find(process.cwd(), plugins);

    await execa(`node`, [`-r`, configuration.pnpPath, ... args], {
      stdin, stdout, stderr
    });
  });
