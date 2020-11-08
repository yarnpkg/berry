import {BuildDirective, BuildType, Configuration, DependencyMeta, FetchResult, LinkType, Manifest, MessageName, Package, Report, structUtils} from '@yarnpkg/core';
import {Filename, ppath}                                                                                                                      from '@yarnpkg/fslib';

export type ManifestCompatibilityDataRequirements = {
  manifest: Pick<Manifest, 'cpu' | 'os'>,
};

export function checkAndReportManifestCompatibility(pkg: Package, requirements: ManifestCompatibilityDataRequirements, label: string, {configuration, report}: {configuration: Configuration, report?: Report | null}) {
  if (!Manifest.isManifestFieldCompatible(requirements.manifest.os, process.platform)) {
    report?.reportWarningOnce(MessageName.INCOMPATIBLE_OS, `${structUtils.prettyLocator(configuration, pkg)} The platform ${process.platform} is incompatible with this module, ${label} skipped.`);
    return false;
  }

  if (!Manifest.isManifestFieldCompatible(requirements.manifest.cpu, process.arch)) {
    report?.reportWarningOnce(MessageName.INCOMPATIBLE_CPU, `${structUtils.prettyLocator(configuration, pkg)} The CPU architecture ${process.arch} is incompatible with this module, ${label} skipped.`);
    return false;
  }

  return true;
}

export type ExtractBuildScriptDataRequirements = ManifestCompatibilityDataRequirements & {
  manifest: Pick<Manifest, 'scripts'>,
  misc: {
    hasBindingGyp: boolean,
  },
};

export function extractBuildScripts(pkg: Package, requirements: ExtractBuildScriptDataRequirements, dependencyMeta: DependencyMeta, {configuration, report}: {configuration: Configuration, report?: Report | null}) {
  const buildScripts: Array<BuildDirective> = [];

  for (const scriptName of [`preinstall`, `install`, `postinstall`])
    if (requirements.manifest.scripts.has(scriptName))
      buildScripts.push([BuildType.SCRIPT, scriptName]);

  // Detect cases where a package has a binding.gyp but no install script
  if (!requirements.manifest.scripts.has(`install`) && requirements.misc.hasBindingGyp)
    buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

  if (!configuration.get(`enableScripts`) && !dependencyMeta.built) {
    report?.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but all build scripts have been disabled.`);
    return [];
  }

  if (pkg.linkType !== LinkType.HARD) {
    report?.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
    return [];
  }

  if (dependencyMeta && dependencyMeta.built === false) {
    report?.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`);
    return [];
  }

  const isManifestCompatible = checkAndReportManifestCompatibility(pkg, requirements, `build`, {configuration, report});
  if (!isManifestCompatible)
    return [];

  return buildScripts;
}

const FORCED_EXTRACT_FILETYPES = new Set([
  // Windows can't execute exe files inside zip archives
  `.exe`,
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
  const bindingFilePath = ppath.join(fetchResult.prefixPath, `binding.gyp` as Filename);
  return fetchResult.packageFs.existsSync(bindingFilePath);
}
