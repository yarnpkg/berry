import {readFileSync}                                             from 'fs';

import {PackageInformationStores, LocationBlacklist, PnpSettings} from './types';

function generateDatastores(packageInformationStores: PackageInformationStores, blacklistedLocations: LocationBlacklist) {
  let code = ``;

  // Bake the information stores into our generated code
  code += `let packageInformationStores = new Map([\n`;
  for (const [packageName, packageInformationStore] of packageInformationStores) {
    code += `  [${JSON.stringify(packageName)}, new Map([\n`;
    for (const [
      packageReference,
      {packageMainEntry, packageLocation, packageDependencies},
    ] of packageInformationStore) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: ${JSON.stringify(packageLocation)},\n`;
      if (packageMainEntry) {
        code += `      packageMainEntry: ${JSON.stringify(packageMainEntry)},\n`;
      }
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
  code += `let locatorsByLocations = new Map([\n`;
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

  return code;
}

function generateFindPackageLocator(packageInformationStores: PackageInformationStores) {
  let code = ``;

  // We get the list of each string length we'll need to check in order to find the current package context
  const lengths = new Map();

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

  // Generate a function that, given a file path, returns the associated package name
  code += `exports.findPackageLocator = function findPackageLocator(location) {\n`;
  code += `  let relativeLocation = path.relative(__dirname, location);\n`;
  code += `\n`;
  code += `  if (!relativeLocation.match(isStrictRegExp))\n`;
  code += `    relativeLocation = \`./\${relativeLocation}\`;\n`;
  code += `\n`;
  code += `  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')\n`;
  code += `    relativeLocation = \`\${relativeLocation}/\`;\n`;
  code += `\n`;
  code += `  let match;\n`;

  for (const [length] of sortedLengths) {
    code += `\n`;
    code += `  if (relativeLocation.length >= ${length} && relativeLocation[${length - 1}] === '/')\n`;
    code += `    if (match = locatorsByLocations.get(relativeLocation.substr(0, ${length})))\n`;
    code += `      return blacklistCheck(match);\n`;
  }

  code += `\n`;
  code += `  return null;\n`;
  code += `};\n`;

  return code;
}

export function generatePnpScript(settings: PnpSettings): string {
  const {packageInformationStores, blacklistedLocations} = settings;

  let dynamicallyGeneratedCode = ``;

  dynamicallyGeneratedCode += generateDatastores(packageInformationStores, blacklistedLocations);
  dynamicallyGeneratedCode += generateFindPackageLocator(packageInformationStores);

  const replacements = Object.assign({}, settings.replacements, {
    DYNAMICALLY_GENERATED_CODE: dynamicallyGeneratedCode,
  });

  const template = readFileSync(`${__dirname}/pnpTemplate.js`, `utf8`).replace(/\${2}[A-Z]+(?:_[A-Z+])/g, name => {
    return replacements[name];
  });

  return template;
}
