import {getFormat as getFormatHook} from './hooks/getFormat';
import {getSource as getSourceHook} from './hooks/getSource';
import {load as loadHook}           from './hooks/load';
import {resolve as resolveHook}     from './hooks/resolve';
import './fspatch';

const [major, minor] = process.versions.node.split(`.`).map(value => parseInt(value, 10));

// The hooks were consolidated in https://github.com/nodejs/node/pull/37468
const hasConsolidatedHooks = major > 16 || (major === 16 && minor >= 12);

export const resolve = resolveHook;
export const getFormat = hasConsolidatedHooks ? undefined : getFormatHook;
export const getSource = hasConsolidatedHooks ? undefined : getSourceHook;
export const load = hasConsolidatedHooks ? loadHook : undefined;
