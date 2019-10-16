import {PortablePath, npath}                        from '@yarnpkg/fslib';
import {PnpApi, PackageInformation, PackageLocator} from '@yarnpkg/pnp';

/**
 * PnP API wrapper working with portable paths
 */
export class PortablePnPApi {
  private pnp: PnpApi;

  public VERSIONS: {std: number, [key: string]: number};
  public topLevel: {name: null, reference: null};

  constructor(baseApi: PnpApi) {
    this.pnp = baseApi;
    this.VERSIONS = baseApi.VERSIONS;
    this.topLevel = baseApi.topLevel;
  }

  public getPackageInformation(locator: PackageLocator): PackageInformation<PortablePath> | null {
    const nativeInfo = this.pnp.getPackageInformation(locator);
    let portableInfo: PackageInformation<PortablePath> | null = null;
    if (nativeInfo) {
      portableInfo = {
        packageLocation: npath.toPortablePath(nativeInfo.packageLocation),
        packageDependencies: nativeInfo.packageDependencies,
        linkType: nativeInfo.linkType,
      };
    }
    return portableInfo;
  }

  public findPackageLocator(location: PortablePath): PackageLocator | null {
    return this.pnp.findPackageLocator(npath.fromPortablePath(location));
  }

  public resolveToUnqualified(request: string, issuer: PortablePath | null, opts?: {considerBuiltins?: boolean}): PortablePath | null {
    const result = this.pnp.resolveToUnqualified(request, !issuer ? null : npath.fromPortablePath(issuer), opts);
    return !result ? null : npath.toPortablePath(result);
  }

  public resolveUnqualified(unqualified: PortablePath, opts?: {extensions?: Array<string>}): PortablePath {
    return npath.toPortablePath(this.pnp.resolveUnqualified(npath.fromPortablePath(unqualified), opts));
  }

  public resolveRequest(request: string, issuer: PortablePath | null, opts?: {considerBuiltins?: boolean, extensions?: Array<string>}): PortablePath | null {
    const result = this.pnp.resolveRequest(request, !issuer ? null : npath.fromPortablePath(issuer), opts);
    return !result ? null : npath.toPortablePath(result);
  }
}
