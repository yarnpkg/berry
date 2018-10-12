import execa = require('execa');
import Joi = require('joi');

import {Configuration} from '@berry/core';
import {Stream}        from 'stream';

import {plugins}       from '../plugins';

export default (concierge: any) => concierge

  .command(`node [... args]`)
  .describe(`run node with the hook setup`)
  .flags({proxyArguments: true})

  .validate(Joi.object().unknown().keys({
    cwd: Joi.string().default(process.cwd()),
  }))

  .action(async ({cwd, stdin, stdout, stderr, args}: {cwd: string, stdin: Stream, stdout: Stream, stderr: Stream, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);

    await execa(`node`, [`-r`, configuration.pnpPath, ... args], {
      stdin, stdout, stderr
    });
  });
