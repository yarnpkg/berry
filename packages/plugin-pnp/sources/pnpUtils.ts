import {Locator, structUtils, Configuration} from '@yarnpkg/core';
import {Filename, NativePath, ppath}         from '@yarnpkg/fslib';

export function getUnpluggedPath(locator: Locator, {configuration}: {configuration: Configuration}) {
  return ppath.resolve(configuration.get(`pnpUnpluggedFolder`), structUtils.slugifyLocator(locator));
}

// NODE_OPTIONS reference: https://github.com/nodejs/node/blob/926503b66910d9ec895c33c7fd94361fd78dea72/src/node_options.cc#L1493
// - Double quotes are supported, single quotes aren't.
// - Backslashes escape the next character.
const ARGUMENT_PART_REGEXP = /(?:(?:"(?<quoted>(?:(?:[^\\](?:\\\\)*\\")|[^"])+)")|(?<plain>[^" ]+))/g;
const ARGUMENT_REGEXP = new RegExp(`${ARGUMENT_PART_REGEXP.source}+`, `g`);

// We still support .pnp.js files to improve multi-project compatibility.
// TODO: Drop support for .pnp.js files after they stop being used.
function isPnpHookPath(p: NativePath) {
  return p.endsWith(Filename.pnpCjs) || p.endsWith(Filename.pnpJs);
}

export function cleanNodeOptions(nodeOptions: string) {
  const args = [...nodeOptions.match(ARGUMENT_REGEXP) ?? []];

  function parseArg(arg: string)  {
    const parts = [...arg.matchAll(ARGUMENT_PART_REGEXP)];

    return parts.map(({groups}) => groups?.plain ?? groups?.quoted?.replace(/\\(?!\\)/g, ``)).join(``);
  }

  const finalArgs = [];
  for (let t = 0; t < args.length; ++t) {
    const arg = parseArg(args[t]);

    const nextArg = args[t + 1];
    if (typeof nextArg !== `undefined`) {
      const p = parseArg(nextArg);
      if (((arg === `--require` || arg === `-r`) && isPnpHookPath(p)) || (arg === `--experimental-loader` && p.endsWith(Filename.pnpEsmLoader))) {
        ++t;
        continue;
      }
    }

    if (arg.startsWith(`--require=`) && isPnpHookPath(arg.slice(10)))
      continue;
    if (arg.startsWith(`--experimental-loader=`) && arg.slice(21).endsWith(Filename.pnpEsmLoader))
      continue;

    finalArgs.push(args[t]);
  }

  return finalArgs.join(` `);
}
