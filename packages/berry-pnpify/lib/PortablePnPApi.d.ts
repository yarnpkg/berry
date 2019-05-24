import { PortablePath } from '@berry/fslib';
import { PnpApi, PackageInformation, PackageLocator } from '@berry/pnp';
/**
 * PnP API wrapper working with portable paths
 */
export declare class PortablePnPApi {
    private pnp;
    VERSIONS: {
        std: number;
        [key: string]: number;
    };
    topLevel: {
        name: null;
        reference: null;
    };
    constructor(baseApi: PnpApi);
    getPackageInformation(locator: PackageLocator): PackageInformation<PortablePath> | null;
    findPackageLocator(location: PortablePath): PackageLocator | null;
    resolveToUnqualified(request: string, issuer: PortablePath | null, opts?: {
        considerBuiltins?: boolean;
    }): PortablePath | null;
    resolveUnqualified(unqualified: PortablePath, opts?: {
        extensions?: Array<string>;
    }): PortablePath;
    resolveRequest(request: string, issuer: PortablePath | null, opts?: {
        considerBuiltins?: boolean;
        extensions?: Array<string>;
    }): PortablePath | null;
}
