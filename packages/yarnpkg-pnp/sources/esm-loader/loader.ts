import nodeModule                            from 'module';

import {load as loadHook, loadSync}          from './hooks/load';
import {resolve as resolveHook, resolveSync} from './hooks/resolve';
import './fspatch';

export const resolve = resolveHook;
export const load = loadHook;

// Node.js 28 removed the off-thread hooks (`--experimental-loader` and
// `module.register`), so the exports above can't be used there. This file is
// instead expected to be preloaded (`--import`), and registers the in-thread
// hooks by itself.
const {registerHooks} = nodeModule as typeof nodeModule & {
  registerHooks?: (hooks: {resolve: typeof resolveSync, load: typeof loadSync}) => unknown;
};

if (typeof registerHooks === `function` && !process.allowedNodeEnvironmentFlags.has(`--experimental-loader`))
  registerHooks({resolve: resolveSync, load: loadSync});
