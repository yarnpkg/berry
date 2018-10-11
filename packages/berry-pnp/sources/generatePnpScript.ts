import template = require('!raw-loader!@berry/pnp/hook-bundle');

import {PackageInformationStores, LocationBlacklist, PnpSettings} from './types';

function generateDatastores(packageInformationStores: PackageInformationStores, blacklistedLocations: LocationBlacklist) {
  let code = ``;

  // Bake the information stores into our generated code
  code += `packageInformationStores = new Map([\n`;
  for (const [packageName, packageInformationStore] of packageInformationStores) {
    code += `  [${JSON.stringify(packageName)}, new Map([\n`;
    for (const [
      packageReference,
      {packageLocation, packageDependencies},
    ] of packageInformationStore) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: path.resolve(__dirname, ${JSON.stringify(packageLocation)}),\n`;
      code += `      packageDependencies: new Map([\n`;
      for (const [dependencyName, dependencyReference] of packageDependencies.entries()) {
        code += `        [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
      }
      code += `      ]),\n`;
      code += `    }],\n`;
    }
    code += `  ])],\n`;
  }
  code += `]);\n`;

  code += `\n`;

  // Also bake an inverse map that will allow us to find the package information based on the path
  code += `packageLocatorByLocationMap = new Map([\n`;
  for (const blacklistedLocation of blacklistedLocations) {
    code += `  [${JSON.stringify(blacklistedLocation)}, blacklistedLocator],\n`;
  }
  for (const [packageName, packageInformationStore] of packageInformationStores) {
    for (const [packageReference, {packageLocation}] of packageInformationStore) {
      if (packageName !== null) {
        code += `  [${JSON.stringify(packageLocation)}, ${JSON.stringify({
          name: packageName,
          reference: packageReference,
        })}],\n`;
      } else {
        code += `  [${JSON.stringify(packageLocation)}, topLevelLocator],\n`;
      }
    }
  }
  code += `]);\n`;

  code += `\n`;

  // And finally generate a sorted array of all the lengths that the findPackageLocator method will need to check
  const lengths: Map<number, number> = new Map();

  for (const packageInformationStore of packageInformationStores.values()) {
    for (const {packageLocation} of packageInformationStore.values()) {
      if (packageLocation === null) {
        continue;
      }

      const length = packageLocation.length;
      const count = (lengths.get(length) || 0) + 1;

      lengths.set(length, count);
    }
  }

  // We must try the larger lengths before the smaller ones, because smaller ones might also match the longest ones
  // (for instance, /project/path will match /project/path/.pnp/global/node_modules/pnp-cf5f9c17b8f8db)
  const sortedLengths = Array.from(lengths.entries()).sort((a, b) => {
    return b[0] - a[0];
  });

  code += `packageLocationLengths = [\n`;
  for (const [length, count] of sortedLengths) {
    code += `  ${length},\n`;
  }
  code += `];\n`;

  return code;
}

export function generatePnpScript(settings: PnpSettings): string {
  const {packageInformationStores, blacklistedLocations} = settings;
  const datastores = generateDatastores(packageInformationStores, blacklistedLocations);

  return [
    `var __non_webpack_module__ = module;\n`,
    `\n`,
    `function $$DYNAMICALLY_GENERATED_CODE(topLevelLocator, blacklistedLocator) {\n`,
    `  var path = require('path');\n`,
    `\n`,
    `  var ignorePattern, packageInformationStores, packageLocatorByLocationMap, packageLocationLengths;\n`,
    `\n`,
    `  ignorePattern = null;\n`,
    `\n`,
    datastores.replace(/^/gm, `  `),
    `\n`,
    `  return {\n`,
    `    ignorePattern: ignorePattern,\n`,
    `    packageInformationStores: packageInformationStores,\n`,
    `    packageLocatorByLocationMap: packageLocatorByLocationMap,\n`,
    `    packageLocationLengths: packageLocationLengths,\n`,
    `  };\n`,
    `}\n`,
    `\n`,
    template,
  ].join(``);
}
