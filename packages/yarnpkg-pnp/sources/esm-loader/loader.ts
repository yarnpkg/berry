import {load as loadHook}       from './hooks/load';
import {resolve as resolveHook} from './hooks/resolve';
import './fspatch';

export const resolve = resolveHook;
export const load = loadHook;
