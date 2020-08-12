import {Installer, Locator, FetchResult, Package, Descriptor, LinkOptions, structUtils, LinkType} from '@yarnpkg/core';
import {PortablePath, xfs, Filename, ppath, npath}                                                from '@yarnpkg/fslib';

import * as folderUtils                                                                           from './folderUtils';

export class CmakeInstaller implements Installer {
  private dependencies: Map<string, {
    packageLocator: Locator,
    packageLocation: PortablePath,
    packageDependencies: Set<string>,
  }> = new Map();

  constructor(protected opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const vendorLocation = folderUtils.getPackagePath(pkg, {
      configuration: this.opts.project.configuration,
    });

    await xfs.mkdirPromise(vendorLocation, {recursive: true});
    if (pkg.linkType === LinkType.HARD)
      await xfs.copyPromise(vendorLocation, fetchResult.prefixPath, {baseFs: fetchResult.packageFs, overwrite: false});

    const packageLocation = pkg.linkType === LinkType.HARD
      ? vendorLocation
      : ppath.resolve(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);

    this.dependencies.set(pkg.locatorHash, {
      packageLocator: pkg,
      packageLocation,
      packageDependencies: new Set(),
    });

    return {
      packageLocation,
      buildDirective: [],
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    const entry = this.dependencies.get(locator.locatorHash);
    if (typeof entry === `undefined`)
      throw new Error(`Assertion failed: Expected locator to be registered (${structUtils.prettyLocator(this.opts.project.configuration, locator)})`);

    for (const [, dependency] of dependencies) {
      entry.packageDependencies.add(dependency.locatorHash);
    }
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
  }

  async finalizeInstall() {
    await this.writePathMap();
    await this.writeCmakeDefs();
  }

  private async writePathMap() {
    const data: {[key: string]: string} = {};
    for (const [locatorStr, {packageLocation}] of this.dependencies)
      data[locatorStr] = ppath.relative(this.opts.project.cwd, packageLocation);

    const pathmapFile = folderUtils.getPathmapPath({
      configuration: this.opts.project.configuration,
    });

    await xfs.writeFilePromise(pathmapFile, `${JSON.stringify(data, null, 2)}\n`);
  }

  private async writeCmakeDefs() {
    let content = ``;

    content += `cmake_minimum_required(VERSION 2.8)\n`;
    content += `project("${this.opts.project.topLevelWorkspace.computeCandidateName()}")\n`;

    content += `\n`;
    for (const {packageLocator, packageLocation} of this.dependencies.values())
      content += `set("YARN_LOCATION_TO_LOCATOR:${ppath.relative(this.opts.project.cwd, packageLocation)}" "${packageLocator.locatorHash}")\n`;

    content += `\n`;
    for (const {packageLocator, packageLocation} of this.dependencies.values())
      content += `set("YARN_LOCATOR_TO_LOCATION_${packageLocator.locatorHash}" "${ppath.relative(this.opts.project.cwd, packageLocation)}")\n`;

    content += `\n`;
    for (const {packageLocator, packageDependencies} of this.dependencies.values())
      content += `set("YARN_LOCATOR_TO_DEPENDENCIES_${packageLocator.locatorHash}" "${[...packageDependencies].join(`;`)}")\n`;

    content += `\n`;
    content += `function(find_yarn_dependencies)\n`;
    content += `  file(RELATIVE_PATH REL "\${CMAKE_SOURCE_DIR}" "\${CMAKE_CURRENT_SOURCE_DIR}")\n`;
    content += `  set(LOOKUP_KEY "YARN_LOCATION_TO_LOCATOR:\${REL}")\n`;
    content += `  set(LOCATOR "\${\${LOOKUP_KEY}}")\n`;
    content += `  foreach(DEPENDENCY \${YARN_LOCATOR_TO_DEPENDENCIES_\${LOCATOR}})\n`;
    content += `    add_subdirectory("\${CMAKE_SOURCE_DIR}/\${YARN_LOCATOR_TO_LOCATION_\${DEPENDENCY}}" "dep-\${DEPENDENCY}")\n`;
    content += `  endforeach()\n`;
    content += `endfunction()\n`;

    const defsFile = folderUtils.getCmakeDefsPath({
      project: this.opts.project,
    });

    await xfs.writeFilePromise(defsFile, content);
  }
}
