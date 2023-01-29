// Adapted from https://github.com/TypeStrong/ts-node/blob/97f9afd046b66a0fe05a7d76e7a32f94b872016f/dist-raw/node-options.js
// which has the following license:

/**
  @license
  The MIT License (MIT)

  Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

// It adapts code from Node.js with the following license:

/**
  @license
  Copyright Joyent, Inc. and other Node contributors.

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the
  following conditions:

  The above copyright notice and this permission notice shall be included
  in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// Replacement for node's internal 'internal/options' module

import arg from 'arg';

export function getOptionValue(opt) {
  parseOptions();
  return options[opt];
}

let options;
function parseOptions() {
  if (!options) {
    options = {
      '--conditions': [],
      ...parseArgv(getNodeOptionsEnvArgv()),
      ...parseArgv(process.execArgv),
    };
  }
}

function parseArgv(argv) {
  return arg(
    {
      '--conditions': [String],
      '-C': '--conditions',
    },
    {
      argv,
      permissive: true,
    }
  );
}

function getNodeOptionsEnvArgv() {
  const errors = [];
  const envArgv = ParseNodeOptionsEnvVar(process.env.NODE_OPTIONS || '', errors);
  if (errors.length !== 0) {
    // TODO: handle errors somehow
  }
  return envArgv;
}

// Direct JS port of C implementation: https://github.com/nodejs/node/blob/67ba825037b4082d5d16f922fb9ce54516b4a869/src/node_options.cc#L1024-L1063
function ParseNodeOptionsEnvVar(node_options, errors) {
  const env_argv = [];

  let is_in_string = false;
  let will_start_new_arg = true;
  for (let index = 0; index < node_options.length; ++index) {
    let c = node_options[index];

    // Backslashes escape the following character
    if (c === '\\' && is_in_string) {
      if (index + 1 === node_options.length) {
        errors.push('invalid value for NODE_OPTIONS ' + '(invalid escape)\n');
        return env_argv;
      } else {
        c = node_options[++index];
      }
    } else if (c === ' ' && !is_in_string) {
      will_start_new_arg = true;
      continue;
    } else if (c === '"') {
      is_in_string = !is_in_string;
      continue;
    }

    if (will_start_new_arg) {
      env_argv.push(c);
      will_start_new_arg = false;
    } else {
      env_argv[env_argv.length - 1] += c;
    }
  }

  if (is_in_string) {
    errors.push('invalid value for NODE_OPTIONS ' + '(unterminated string)\n');
  }
  return env_argv;
}
