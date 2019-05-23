/// <reference types="node" />
import { FakeFS, ProxiedFS } from '@berry/fslib';
import { NativePath, PortablePath } from '@berry/fslib';
import { PnpApi } from '@berry/pnp';
import fs from 'fs';
export declare type NodeModulesFSOptions = {
    realFs?: typeof fs;
};
export declare class NodeModulesFS extends ProxiedFS<NativePath, PortablePath> {
    protected readonly baseFs: FakeFS<PortablePath>;
    constructor(pnp: PnpApi, { realFs }?: NodeModulesFSOptions);
    protected mapFromBase(path: PortablePath): NativePath;
    protected mapToBase(path: NativePath): PortablePath;
}
