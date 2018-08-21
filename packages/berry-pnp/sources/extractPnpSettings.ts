import {Project}                                                                        from '@berry/core';

import {PackageInformationStores, LocationBlacklist, TemplateReplacements, PnpSettings} from './types';

export async function extractPnpSettings(project: Project): Promise<PnpSettings> {
  const packageInformationStores: PackageInformationStores = new Map();
  const blacklistedLocations: LocationBlacklist = new Set();
  const replacements: TemplateReplacements = {};

  replacements.SHEBANG = project.configuration.pnpShebang;

  return {packageInformationStores, blacklistedLocations, replacements};
}
