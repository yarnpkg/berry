import {Descriptor, Project, structUtils, ReportError, MessageName} from '@yarnpkg/core';

import {CATALOG_DESCRIPTOR_PREFIX}                                  from './constants';

export const isCatalogReference = (range: string) => {
  return range.startsWith(CATALOG_DESCRIPTOR_PREFIX);
};

export const getCatalogName = (dependency: Descriptor) => {
  return dependency.range.slice(CATALOG_DESCRIPTOR_PREFIX.length) || null;
};

const getCatalogErrorDisplayName = (catalogName: string | null) => {
  return catalogName === null ? `default catalog` : `catalog "${catalogName}"`;
};

export const resolveDescriptorFromCatalog = (project: Project, dependency: Descriptor) => {
  const catalogName = getCatalogName(dependency);
  let catalog: Map<string, string> | undefined;

  if (catalogName === null) {
    // Use default catalog when no name is specified (catalog:)
    catalog = project.configuration.get(`catalog`);
  } else {
    // Use named catalog when a name is specified (catalog:name)
    try {
      const catalogs = project.configuration.get(`catalogs`);
      if (catalogs) {
        catalog = catalogs.get(catalogName);
      }
    } catch {
      catalog = undefined;
    }
  }


  if (!catalog || catalog.size === 0)
    throw new ReportError(MessageName.RESOLUTION_FAILED, `${structUtils.prettyDescriptor(project.configuration, dependency)}: ${getCatalogErrorDisplayName(catalogName)} not found or empty`);


  const resolvedRange = catalog.get(dependency.name);
  if (!resolvedRange)
    throw new ReportError(MessageName.RESOLUTION_FAILED, `${structUtils.prettyDescriptor(project.configuration, dependency)}: entry not found in ${getCatalogErrorDisplayName(catalogName)}`);


  // The range resolved from the catalog may need to be normalized (.i.e. ^2.4.0 -> npm:^2.4.0)
  // This process typically happens before the reduceDependency hook, but we need to do it here since
  // when it is first called the dependency range still refers to the catalog
  const normalizedDescriptor = project.configuration.normalizeDependency(
    structUtils.makeDescriptor(dependency, resolvedRange),
  );

  return normalizedDescriptor;
};
