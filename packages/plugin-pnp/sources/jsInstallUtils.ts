import {BuildDirective, BuildDirectiveType, Configuration, DependencyMeta, FetchResult, LinkType, Manifest, MessageName, Package, BuildRequest, nodeUtils, structUtils} from '@yarnpkg/core';
import {ppath}                                                                                                                                                          from '@yarnpkg/fslib';

export function checkManifestCompatibility(pkg: Package) {
  return structUtils.isPackageCompatible(pkg, nodeUtils.getArchitectureSet());
}

export type ExtractBuildScriptDataRequirements = {
  manifest: Pick<Manifest, 'scripts'>;
  misc: {
    hasBindingGyp: boolean;
  };
};

export function extractBuildRequest(pkg: Package, requirements: ExtractBuildScriptDataRequirements, dependencyMeta: DependencyMeta, {configuration}: {configuration: Configuration}): BuildRequest | null {
  const directives: Array<BuildDirective> = [];

  for (const scriptName of [`preinstall`, `install`, `postinstall`])
    if (requirements.manifest.scripts.has(scriptName))
      directives.push({type: BuildDirectiveType.SCRIPT, script: scriptName});

  // Detect cases where a package has a binding.gyp but no install script
  if (!requirements.manifest.scripts.has(`install`) && requirements.misc.hasBindingGyp)
    directives.push({type: BuildDirectiveType.SHELLCODE, script: `node-gyp rebuild`});

  if (directives.length === 0)
    return null;

  if (pkg.linkType !== LinkType.HARD)
    return {skipped: true, explain: report => report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`)};

  if (dependencyMeta && dependencyMeta.built === false)
    return {skipped: true, explain: report => report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`)};

  if (!configuration.get(`enableScripts`) && !dependencyMeta.built)
    return {skipped: true, explain: report => report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but all build scripts have been disabled.`)};

  if (!checkManifestCompatibility(pkg))
    return {skipped: true, explain: report => report.reportWarningOnce(MessageName.INCOMPATIBLE_ARCHITECTURE, `${structUtils.prettyLocator(configuration, pkg)} The ${nodeUtils.getArchitectureName()} architecture is incompatible with this package, build skipped.`)};

  return {skipped: false, directives};
}

const FORCED_EXTRACT_FILETYPES = new Set([
  // Windows can't execute exe files inside zip archives
  `.exe`,
  // May be used for some binaries on Linux; https://askubuntu.com/a/174356
  `.bin`,
  // The c/c++ compiler can't read files from zip archives
  `.h`, `.hh`, `.hpp`, `.c`, `.cc`, `.cpp`,
  // The java runtime can't read files from zip archives
  `.java`, `.jar`,
  // Node opens these through dlopen
  `.node`,
]);

export function getExtractHint(fetchResult: FetchResult) {
  return fetchResult.packageFs.getExtractHint({relevantExtensions: FORCED_EXTRACT_FILETYPES});
}

export function hasBindingGyp(fetchResult: FetchResult) {
  const bindingFilePath = ppath.join(fetchResult.prefixPath, `binding.gyp`);
  return fetchResult.packageFs.existsSync(bindingFilePath);
}
