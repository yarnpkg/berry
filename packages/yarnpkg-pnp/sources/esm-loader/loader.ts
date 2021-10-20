import {getFormat as getFormatHook} from './hooks/getFormat';
import {getSource as getSourceHook} from './hooks/getSource';
import {load as loadHook}           from './hooks/load';
import {resolve as resolveHook}     from './hooks/resolve';
import './fspatch';

const [major, minor] = process.versions.node.split(`.`).map(value => parseInt(value, 10));

const hasConsolidatedLoaders = major > 16 || (major === 16 && minor >= 12);

export const resolve = resolveHook;

// Removed in Node v16.12.0
export const getFormat = hasConsolidatedLoaders ? undefined : getFormatHook;

// Removed in Node v16.12.0
export const getSource = hasConsolidatedLoaders ? undefined : getSourceHook;

// Added in Node v16.12.0
export const load = hasConsolidatedLoaders ? loadHook : undefined;
