import {Descriptor, Project, structUtils} from '@yarnpkg/core';

import {CATALOG_DESCRIPTOR_PREFIX}        from './constants';

export const isCatalogReference = (range: string) => {
  return range.startsWith(CATALOG_DESCRIPTOR_PREFIX);
};

export const getCatalogReferenceName = (dependency: Descriptor) => {
  // support both catalog:referenceName and catalog: which defaults to the package name
  return dependency.range.slice(CATALOG_DESCRIPTOR_PREFIX.length) || dependency.name;
};

export const resolveDescriptorFromCatalog = (project: Project, dependency: Descriptor) => {
  const catalog = project.configuration.get(`catalog`);
  if (!catalog)
    throw new Error(`Catalog not found in project`);

  const catalogReference = getCatalogReferenceName(dependency);
  const resolvedRange = catalog.get(catalogReference);
  if (!resolvedRange)
    throw new Error(`Range not found in Catalog for ${catalogReference}`);

  // The range resolved from the catalog may need to be normalized
  // This process typically happens before the reduceDependency hook
  const normalizedDescriptor = project.configuration.normalizeDependency(
    structUtils.makeDescriptor(dependency, resolvedRange),
  );

  return normalizedDescriptor;
};
