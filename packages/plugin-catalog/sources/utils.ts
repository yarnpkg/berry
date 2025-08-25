import {Descriptor, Project, structUtils, ReportError, MessageName} from '@yarnpkg/core';

import {CATALOG_DESCRIPTOR_PREFIX}                                  from './constants';

export const isCatalogReference = (range: string) => {
  return range.startsWith(CATALOG_DESCRIPTOR_PREFIX);
};

export const getCatalogReferenceName = (dependency: Descriptor) => {
  // support both catalog:referenceName and catalog: which defaults to the package name
  return dependency.range.slice(CATALOG_DESCRIPTOR_PREFIX.length) || dependency.name;
};

export const resolveDescriptorFromCatalog = (project: Project, dependency: Descriptor) => {
  const catalog = project.configuration.get(`catalog`);
  if (!catalog || catalog.size === 0)
    throw new ReportError(MessageName.RESOLUTION_FAILED, `${structUtils.prettyDescriptor(project.configuration, dependency)}: catalog not found or empty`);

  const catalogReference = getCatalogReferenceName(dependency);
  const resolvedRange = catalog.get(catalogReference);
  if (!resolvedRange)
    throw new ReportError(MessageName.RESOLUTION_FAILED, `${structUtils.prettyDescriptor(project.configuration, dependency)}: catalog entry ${structUtils.prettyIdent(project.configuration, structUtils.makeIdent(null, catalogReference))} not found`);

  // The range resolved from the catalog may need to be normalized (.i.e. ^2.4.0 -> npm:^2.4.0)
  // This process typically happens before the reduceDependency hook, but we need to do it here since
  // when it is first called the dependency range still refers to the catalog
  const normalizedDescriptor = project.configuration.normalizeDependency(
    structUtils.makeDescriptor(dependency, resolvedRange),
  );

  return normalizedDescriptor;
};
