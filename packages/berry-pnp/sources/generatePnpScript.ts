import {miscUtils}                                                                        from '@berry/core';
// @ts-ignore: This isn't a classical file; it's automatically generated (type string)
import template                                                                           from '@berry/pnp/sources/hook-bundle.js';

import {PackageRegistryData, PackageStoreData, LocationBlacklistData, LocationLengthData} from './types';
import {PnpSettings}                                                                      from './types';

function generateLoader(shebang: string | null | undefined, datastores: string) {
  return [
    shebang ? `${shebang}\n\n` : ``,
    `try {\n`, 
    `  Object.freeze({}).detectStrictMode = true;\n`,
    `} catch (error) {\n`,
    `  throw new Error(\`The whole PnP file got strict-mode-ified, which is known to break (Emscripten libraries aren't strict mode). This usually happens when the file goes through Babel.\`);\n`,
    `}\n`,
    `\n`,
    `var __non_webpack_module__ = module;\n`,
    `\n`,
    `function $$SETUP_STATE() {\n`,
    `  var path = require('path');\n`,
    `\n`,
    `  var runtimeState = {};\n`,
    `\n`,
    datastores.replace(/^/gm, `  `),
    `\n`,
    `  return runtimeState;\n`,
    `}\n`,
    `\n`,
    template,
  ].join(``);
}

function generatePackageRegistryData(settings: PnpSettings): PackageRegistryData {
  const packageRegistryData: PackageRegistryData = [];

  for (const [packageName, packageStore] of miscUtils.sortMap(settings.packageRegistry, ([packageName]) => packageName === null ? `0` : `1${packageName}`)) {
    const packageStoreData: PackageStoreData = [];
    packageRegistryData.push([packageName, packageStoreData]);

    for (const [packageReference, {packageLocation, packageDependencies}] of miscUtils.sortMap(packageStore, ([packageReference]) => packageReference === null ? `0` : `1${packageReference}`)) {
      const normalizedDependencies: Array<[string, string]> = [];

      if (packageName !== null && packageReference !== null && !packageDependencies.has(packageName))
        normalizedDependencies.push([packageName, packageReference]);

      for (const [dependencyName, dependencyReference] of miscUtils.sortMap(packageDependencies.entries(), ([dependencyName]) => dependencyName))
        normalizedDependencies.push([dependencyName, dependencyReference]);

      packageStoreData.push([packageReference, {
        packageLocation,
        packageDependencies: normalizedDependencies,
      }]);
    }
  }

  return packageRegistryData;
}

function generateLocationBlacklistData(settings: PnpSettings): LocationBlacklistData {
  return miscUtils.sortMap(settings.blacklistedLocations || [], location => location);
}

function generateLocationLengthData(settings: PnpSettings): LocationLengthData {
  const lengths = new Set();

  for (const packageInformationStore of settings.packageRegistry.values())
    for (const {packageLocation} of packageInformationStore.values())
      if (packageLocation !== null)
        lengths.add(packageLocation.length);

  return Array.from(lengths).sort((a, b) => b - a);
}

function generateInlinedData(settings: PnpSettings) {
  let code = ``;

  const packageRegistryData = generatePackageRegistryData(settings);
  const locationBlacklistData = generateLocationBlacklistData(settings);
  const locationLengthData = generateLocationLengthData(settings);

  // Integrates the ignore pattern
  code += settings.ignorePattern
    ? `runtimeState.ignorePattern = new RegExp(${JSON.stringify(settings.ignorePattern)});\n`
    : `runtimeState.ignorePattern = null;\n`;

  code += `\n`;

  // Bake the information stores into our generated code
  code += `runtimeState.packageRegistry = new Map([\n`;
  for (const [packageName, packageStoreData] of packageRegistryData) {
    code += `  [${JSON.stringify(packageName)}, new Map([\n`;
    for (const [packageReference, {packageLocation, packageDependencies}] of packageStoreData) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: path.resolve(__dirname, ${JSON.stringify(packageLocation)}),\n`;
      code += `      packageDependencies: new Map([\n`;
      for (const [dependencyName, dependencyReference] of packageDependencies)
        code += `        [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
      code += `      ]),\n`;
      code += `    }],\n`;
    }
    code += `  ])],\n`;
  }
  code += `]);\n`;

  code += `\n`;

  // Also bake an inverse map that will allow us to find the package information based on the path
  code += `runtimeState.packageLocatorsByLocations = new Map([\n`;
  for (const blacklistedLocation of locationBlacklistData)
    code += `  [${JSON.stringify(blacklistedLocation)}, null],\n`;
  for (const [packageName, packageInformationStoreData] of packageRegistryData) {
    for (const [packageReference, {packageLocation}] of packageInformationStoreData) {
      code += `  [${JSON.stringify(packageLocation)}, ${JSON.stringify({
        name: packageName,
        reference: packageReference,
      })}],\n`;
    }
  }
  code += `]);\n`;

  code += `\n`;

  // Those lengths will be used to find to which package belongs a file
  code += `runtimeState.packageLocationLengths = [\n`;
  for (const length of locationLengthData)
    code += `  ${length},\n`;
  code += `];\n`;

  return code;
}

function generateExternalData(settings: PnpSettings) {
  const data: any = {};

  data.__info = [
    `This file is automatically generated. Do not touch it, or risk`,
    `your modifications being lost. We also recommend you not to read`,
    `it either without using the @berry/pnp package, as the data layout`,
    `is entirely unspecified and WILL change from a version to another.`,
  ];

  data.packageRegistryData = generatePackageRegistryData(settings);
  data.locationBlacklistData = generateLocationBlacklistData(settings);
  data.locationLengthData = generateLocationLengthData(settings);

  return JSON.stringify(data, null, `  `) + `\n`;
}

function generateExternalReader(dataLocation: string) {
  let code = ``;

  code += `var data = require(path.resolve(__dirname, ${JSON.stringify(dataLocation)}));\n`;

  code += `\n`;

  code += `runtimeState.ignorePattern = data.ignorePatternData ? new RegExp(data.ignorePatternData) : null;\n`;

  code += `\n`;

  code += `runtimeState.packageRegistry = new Map(data.packageRegistryData.map(function (entry) {\n`;
  code += `  return [entry[0], new Map(entry[1].map(function (entry) {\n`;
  code += `    return [entry[0], {\n`;
  code += `      packageLocation: path.resolve(__dirname, entry[1].packageLocation),`;
  code += `      packageDependencies: new Map(entry[1].packageDependencies),\n`;
  code += `    }];\n`;
  code += `  }))];\n`;
  code += `}));\n`;

  code += `\n`;

  code += `runtimeState.packageLocatorsByLocations = new Map(data.locationBlacklistData.map(function (location) {\n`;
  code += `  return [location, null];\n`;
  code += `}));\n`
  code += `data.packageRegistryData.forEach(function (entry) {\n`;
  code += `  var packageName = entry[0], store = entry[1];\n`
  code += `  store.forEach(function (entry) {\n`;
  code += `    var packageReference = entry[0], information = entry[1];\n`;
  code += `    runtimeState.packageLocatorsByLocations.set(information.packageLocation, {name: packageName, reference: packageReference});\n`;
  code += `  });\n`;
  code += `});\n`

  code += `\n`;

  code += `runtimeState.packageLocationLengths = data.locationLengthData;\n`;

  return code;
}

export function generateInlinePnpScript(settings: PnpSettings): string {
  const inlinedData = generateInlinedData(settings);
  const loaderFile = generateLoader(settings.shebang, inlinedData);

  return loaderFile;
}

export function generateSplitPnpScript(settings: PnpSettings & {dataLocation: string}): {dataFile: string, loaderFile: string} {
  const externalData = generateExternalData(settings);
  const loaderFile = generateLoader(settings.shebang, generateExternalReader(settings.dataLocation));
  
  return {dataFile: externalData, loaderFile};
}
