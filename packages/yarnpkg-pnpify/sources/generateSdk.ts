import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                                    from '@yarnpkg/pnp';
import chalk                                       from 'chalk';
import CJSON                                       from 'comment-json';

import {dynamicRequire}                            from './dynamicRequire';

type TemplateOptions = {
  setupEnv?: boolean,
  usePnpify?: boolean,
};

const TEMPLATE = (relPnpApiPath: PortablePath, module: string, {setupEnv = false, usePnpify = false}: TemplateOptions) => [
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
  `module.exports = absRequire(\`${module}\`);\n`,
].join(``);

const addVSCodeWorkspaceSettings = async (pnpApi: PnpApi, settings: any) => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const settingsPath = ppath.join(projectRoot, `.vscode/settings.json` as PortablePath);

  const content = await xfs.existsPromise(settingsPath)
    ? await xfs.readFilePromise(settingsPath, `utf8`)
    : `{}`;

  const data = CJSON.parse(content);
  const patched = `${CJSON.stringify({...data, ...settings}, null, 2)}\n`;

  await xfs.mkdirpPromise(ppath.dirname(settingsPath));
  await xfs.changeFilePromise(settingsPath, patched, {
    automaticNewlines: true,
  });
};

class Wrapper {
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

export const generateEslintWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`eslint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/eslint.js` as PortablePath);
  await wrapper.writeFile(`lib/api.js` as PortablePath);

  await addVSCodeWorkspaceSettings(pnpApi, {
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/api.js` as PortablePath,
        ),
      ))),
    ),
  });
};

export const generatePrettierWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`prettier` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`index.js` as PortablePath);

  await addVSCodeWorkspaceSettings(pnpApi, {
    [`prettier.prettierPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `index.js` as PortablePath,
      ),
    ),
  });
};

export const generateTypescriptLanguageServerWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`typescript-language-server` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`lib/cli.js` as PortablePath);
};

const generateTypescriptWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`typescript` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/tsc` as PortablePath);
  await wrapper.writeBinary(`bin/tsserver` as PortablePath);

  await wrapper.writeFile(`lib/tsc.js` as PortablePath);
  await wrapper.writeFile(`lib/tsserver.js` as PortablePath);
  await wrapper.writeFile(`lib/typescript.js` as PortablePath);

  await addVSCodeWorkspaceSettings(pnpApi, {
    [`typescript.tsdk`]: npath.fromPortablePath(
      ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/tsserver.js` as PortablePath,
        ),
      ),
    ),
    [`typescript.enablePromptUseWorkspaceTsdk`]: true,
  });
};

export const generateStylelintWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`stylelint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/stylelint.js` as PortablePath);
  await wrapper.writeFile(`lib/index.js` as PortablePath);

  await addVSCodeWorkspaceSettings(pnpApi, {
    [`stylelint.stylelintPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `lib/index.js` as PortablePath,
      ),
    ),
  });
};

const SDKS: Array<[string, (pnpApi: PnpApi, target: PortablePath) => Promise<void>]> = [
  [`eslint`, generateEslintWrapper],
  [`prettier`, generatePrettierWrapper],
  [`typescript-language-server`, generateTypescriptLanguageServerWrapper],
  [`typescript`, generateTypescriptWrapper],
  [`stylelint`, generateStylelintWrapper],
];

export const generateSdk = async (pnpApi: PnpApi): Promise<any> => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const targetFolder = ppath.join(projectRoot, `.vscode/pnpify` as PortablePath);

  if (xfs.existsSync(targetFolder)) {
    console.log(`Cleaning up the existing SDK files...`);
    await xfs.removePromise(targetFolder);
  }

  console.log(`Installing fresh SDKs for ${chalk.magenta(projectRoot)}:`);
  console.log(``);

  let skippedSome = false;

  for (const [pkgName, generateWrapper] of SDKS) {
    const displayName = pkgName.replace(/^[a-z]/g, $0 => $0.toUpperCase());

    if (topLevelInformation.packageDependencies.has(pkgName)) {
      console.log(`  ${chalk.green(`✓`)} ${displayName}`);
      await generateWrapper(pnpApi, targetFolder);
    } else {
      console.log(`  ${chalk.yellow(`•`)} ${displayName} (dependency not found; skipped)`);
      skippedSome = true;
    }
  }

  if (skippedSome) {
    console.log(``);
    console.log(`Note that in order to be detected those packages have to be listed as top-level`);
    console.log(`dependencies (listing them into each individual workspace won't be enough).`);
  }
};
