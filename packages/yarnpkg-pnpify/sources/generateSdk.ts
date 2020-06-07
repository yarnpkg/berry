import {Report, MessageName}                       from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                                    from '@yarnpkg/pnp';
import chalk                                       from 'chalk';

import {dynamicRequire}                            from './dynamicRequire';

import {BASE_SDKS}                                 from './sdks/base';
import {VSCODE_SDKS}                               from './sdks/vscode';

type TemplateOptions = {
  setupEnv?: boolean,
  usePnpify?: boolean,
  wrapModule?: string,
};

const TEMPLATE = (relPnpApiPath: PortablePath, module: string, {setupEnv = false, usePnpify = false, wrapModule}: TemplateOptions) => [
  `#!/usr/bin/env node\n`,
  `\n`,
  `const {existsSync} = require(\`fs\`);\n`,
  `const {createRequire, createRequireFromPath} = require(\`module\`);\n`,
  `const {resolve} = require(\`path\`);\n`,
  `\n`,
  `const relPnpApiPath = ${JSON.stringify(npath.fromPortablePath(relPnpApiPath))};\n`,
  `\n`,
  `const absPnpApiPath = resolve(__dirname, relPnpApiPath);\n`,
  `const absRequire = (createRequire || createRequireFromPath)(absPnpApiPath);\n`,
  `\n`,
  ...(wrapModule ? [
    `const moduleWrapper = ${wrapModule.trim().replace(/^ {4}/gm, ``)}\n`,
    `\n`,
  ] : []),
  `if (existsSync(absPnpApiPath)) {\n`,
  `  if (!process.versions.pnp) {\n`,
  `    // Setup the environment to be able to require ${module}\n`,
  `    require(absPnpApiPath).setup();\n`,
  `  }\n`,
  ...(setupEnv ? [
    `\n`,
    `  if (typeof global[\`__yarnpkg_sdk_has_setup_env__\`] === \`undefined\`) {\n`,
    `    Object.defineProperty(global, \`__yarnpkg_sdk_has_setup_env__\`, {configurable: true, value: true});\n`,
    `\n`,
    `    process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
    `    process.env.NODE_OPTIONS += \` -r \${absPnpApiPath}\`;\n`,
    `  }\n`,
  ] : []),
  ...(usePnpify ? [
    `\n`,
    `  if (typeof global[\`__yarnpkg_sdk_is_using_pnpify__\`] === \`undefined\`) {\n`,
    `    Object.defineProperty(global, \`__yarnpkg_sdk_is_using_pnpify__\`, {configurable: true, value: true});\n`,
    `\n`,
    `    process.env.NODE_OPTIONS += \` -r \${pnpifyResolution}\`;\n`,
    `\n`,
    `    // Apply PnPify to the current process\n`,
    `    absRequire(\`@yarnpkg/pnpify\`).patchFs();\n`,
    `  }\n`,
  ] : []),
  `}\n`,
  `\n`,
  `// Defer to the real ${module} your application uses\n`,
  wrapModule ? `module.exports = moduleWrapper(absRequire(\`${module}\`));\n` : `module.exports = absRequire(\`${module}\`);\n`,
].join(``);

export class Wrapper {
  private name: PortablePath;

  private pnpApi: PnpApi;
  private target: PortablePath;

  private paths: Map<PortablePath, PortablePath> = new Map();

  constructor(name: PortablePath, {pnpApi, target}: {pnpApi: PnpApi, target: PortablePath}) {
    this.name = name;

    this.pnpApi = pnpApi;
    this.target = target;
  }

  async writeManifest() {
    const absWrapperPath = ppath.join(this.target, this.name, `package.json` as Filename);

    const topLevelInformation = this.pnpApi.getPackageInformation(this.pnpApi.topLevel)!;
    const dependencyReference = topLevelInformation.packageDependencies.get(this.name)!;

    const pkgInformation = this.pnpApi.getPackageInformation(this.pnpApi.getLocator(this.name, dependencyReference));
    if (pkgInformation === null)
      throw new Error(`Assertion failed: Package ${this.name} isn't a dependency of the top-level`);

    const manifest = dynamicRequire(npath.join(pkgInformation.packageLocation, `package.json`));

    await xfs.mkdirpPromise(ppath.dirname(absWrapperPath));
    await xfs.writeFilePromise(absWrapperPath, JSON.stringify({
      name: this.name,
      version: `${manifest.version}-pnpify`,
      main: manifest.main,
      type: `commonjs`,
    }, null, 2));
  }

  async writeBinary(relPackagePath: PortablePath, options: TemplateOptions = {}) {
    const absPackagePath = await this.writeFile(relPackagePath, options);

    await xfs.chmodPromise(absPackagePath, 0o755);
  }

  async writeFile(relPackagePath: PortablePath, options: TemplateOptions = {}) {
    const topLevelInformation = this.pnpApi.getPackageInformation(this.pnpApi.topLevel)!;
    const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

    const absWrapperPath = ppath.join(this.target, this.name, relPackagePath);
    const relProjectPath = ppath.relative(projectRoot, absWrapperPath);

    const absPnpApiPath = npath.toPortablePath(this.pnpApi.resolveRequest(`pnpapi`, null)!);
    const relPnpApiPath = ppath.relative(ppath.dirname(absWrapperPath), absPnpApiPath);

    await xfs.mkdirpPromise(ppath.dirname(absWrapperPath));
    await xfs.writeFilePromise(absWrapperPath, TEMPLATE(relPnpApiPath, ppath.join(this.name, relPackagePath), options));

    this.paths.set(relPackagePath, relProjectPath);

    return absWrapperPath;
  }

  getProjectPathTo(relPackagePath: PortablePath) {
    const relProjectPath = this.paths.get(relPackagePath);

    if (typeof relProjectPath === `undefined`)
      throw new Error(`Assertion failed: Expected path to have been registered`);

    return relProjectPath;
  }
}


export type GenerateBaseWrapper = (pnpApi: PnpApi, target: PortablePath) => Promise<Wrapper>;

export type GenerateEditorWrapper = (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => Promise<void>;

export type BaseSdks = Array<[string, GenerateBaseWrapper]>;

export type EditorSdks = Array<[string, GenerateEditorWrapper | null]>;

export const SUPPORTED_EDITORS = new Set([
  `vscode` as const,
]);

export const generateSdk = async (pnpApi: PnpApi, editors: typeof SUPPORTED_EDITORS | null, report: Report): Promise<void> => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const targetFolder = ppath.join(projectRoot, `.yarn/pnpify` as PortablePath);

  if (xfs.existsSync(targetFolder)) {
    report.reportInfo(null, `Cleaning up the existing SDK files...`);
    await xfs.removePromise(targetFolder);
  }

  report.reportInfo(null, `Installing fresh SDKs for ${chalk.magenta(projectRoot)}:`);
  report.reportSeparator();

  if (editors !== null && editors.size > 0) {
    report.reportInfo(null, `Editors:`);
    for (const editor of editors) {
      report.reportInfo(MessageName.UNNAMED, `${chalk.green(`✓`)} ${editor}`);
    }
  } else {
    report.reportInfo(null, `No editors have been provided as arguments. Updating the base SDK...`);
  }
  report.reportSeparator();

  const EDITOR_SDKS = [
    ...editors?.has(`vscode`) ? [VSCODE_SDKS] : [],
  ];

  report.reportInfo(null, `Dependencies:`);

  let skippedSome = false;

  for (const [pkgName, generateBaseWrapper] of BASE_SDKS) {
    const displayName = pkgName.replace(/^[a-z]/g, $0 => $0.toUpperCase());

    if (topLevelInformation.packageDependencies.has(pkgName)) {
      report.reportInfo(MessageName.UNNAMED, `${chalk.green(`✓`)} ${displayName}`);
      const wrapper = await generateBaseWrapper(pnpApi, targetFolder);

      for (const sdks of EDITOR_SDKS) {
        const editorSdk = sdks.find(sdk => sdk[0] === pkgName);

        if (!editorSdk)
          continue;

        const [, generateEditorWrapper] = editorSdk;

        if (!generateEditorWrapper)
          continue;

        await generateEditorWrapper(pnpApi, targetFolder, wrapper);
      }
    } else {
      report.reportInfo(null, `${chalk.yellow(`•`)} ${displayName} (dependency not found; skipped)`);
      skippedSome = true;
    }
  }

  if (skippedSome) {
    report.reportSeparator();
    report.reportInfo(null, `Note that in order to be detected those packages have to be listed as top-level dependencies (listing them into each individual workspace won't be enough).`);
  }
};
