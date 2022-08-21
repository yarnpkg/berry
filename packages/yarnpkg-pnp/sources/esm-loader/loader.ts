import {getFormat as getFormatHook} from './hooks/getFormat';
import {getSource as getSourceHook} from './hooks/getSource';
import {load as loadHook}           from './hooks/load';
import {resolve as resolveHook}     from './hooks/resolve';
import {HAS_CONSOLIDATED_HOOKS}     from './loaderFlags';
import './fspatch';

export const resolve = resolveHook;
export const getFormat = HAS_CONSOLIDATED_HOOKS ? undefined : getFormatHook;
export const getSource = HAS_CONSOLIDATED_HOOKS ? undefined : getSourceHook;
export const load = HAS_CONSOLIDATED_HOOKS ? loadHook : undefined;
