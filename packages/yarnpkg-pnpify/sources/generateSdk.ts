import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import CJSON                                       from 'comment-json';

import {dynamicRequire}                            from './dynamicRequire';

const TEMPLATE = (relPnpApiPath: PortablePath, module: string, {usePnpify}: {usePnpify: boolean}) => [
  `#!/usr/bin/env node\n`,
  `\n`,
  `const {createRequire, createRequireFromPath} = require(\`module\`);\n`,
  `const {resolve} = require(\`path\`);\n`,
  `\n`,
  `const relPnpApiPath = ${JSON.stringify(npath.fromPortablePath(relPnpApiPath))};\n`,
  `\n`,
  `const absPnpApiPath = resolve(__dirname, relPnpApiPath);\n`,
  `const absRequire = (createRequire || createRequireFromPath)(absPnpApiPath);\n`,
  `\n`,
  `// Setup the environment to be able to require ${module}\n`,
  `require(absPnpApiPath).setup();\n`,
  `\n`,
  `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
  `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${absPnpApiPath}\`;\n`,
  ...(usePnpify ? [
    `process.env.NODE_OPTIONS += \` -r \${pnpifyResolution}\`;\n`,
    `\n`,
    `// Apply PnPify to the current process\n`,
    `absRequire(\`@yarnpkg/pnpify\`).patchFs();\n`,
  ] : []),
  `\n`,
  `// Defer to the real ${module} your application uses\n`,
  `module.exports = absRequire(\`${module}\`);\n`,
].join(``);

const addVSCodeWorkspaceSettings = async (projectRoot: PortablePath, settings: any) => {
  const settingsPath = ppath.join(projectRoot, `.vscode/settings.json` as PortablePath);
  const content = await xfs.existsPromise(settingsPath) ? await xfs.readFilePromise(settingsPath, `utf8`) : `{}`;

  const data = CJSON.parse(content);
  const patched = `${CJSON.stringify({...data, ...settings}, null, 2)}\n`;

  await xfs.mkdirpPromise(ppath.dirname(settingsPath));
  await xfs.changeFilePromise(settingsPath, patched, {
    automaticNewlines: true,
  });
};

class Wrapper {
  private name: PortablePath;

  private projectRoot: PortablePath;
  private target: PortablePath;

  private paths: Map<PortablePath, PortablePath> = new Map();

  constructor(name: PortablePath, {projectRoot, target}: {projectRoot: PortablePath, target: PortablePath}) {
    this.name = name;

    this.projectRoot = projectRoot;
    this.target = target;
  }

  async writeManifest() {
    const absWrapperPath = ppath.join(this.target, this.name, `package.json` as Filename);
    const manifest = dynamicRequire(`${this.name}/package.json`);

    await xfs.mkdirpPromise(ppath.dirname(absWrapperPath));
    await xfs.writeFilePromise(absWrapperPath, JSON.stringify({
      name: this.name,
      version: `${manifest.version}-pnpify`,
      main: manifest.main,
    }, null, 2));
  }

  async writeBinary(relPackagePath: PortablePath) {
    const absPackagePath = await this.writeFile(relPackagePath);

    await xfs.chmodPromise(absPackagePath, 0o755);
  }

  async writeFile(relPackagePath: PortablePath) {
    const absWrapperPath = ppath.join(this.target, this.name, relPackagePath);
    const relPnpApiPath = ppath.relative(ppath.dirname(absWrapperPath), ppath.join(this.projectRoot, `.pnp.js` as Filename));
    const relProjectPath = ppath.relative(this.projectRoot, absWrapperPath);

    await xfs.mkdirpPromise(ppath.dirname(absWrapperPath));
    await xfs.writeFilePromise(absWrapperPath, TEMPLATE(relPnpApiPath, ppath.join(this.name, relPackagePath), {usePnpify: false}));

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

const generateTypescriptWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const wrapper = new Wrapper(`typescript` as PortablePath, {projectRoot, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/tsc` as PortablePath);
  await wrapper.writeBinary(`bin/tsserver` as PortablePath);

  await wrapper.writeFile(`lib/tsc.js` as PortablePath);
  await wrapper.writeFile(`lib/tsserver.js` as PortablePath);

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`typescript.tsdk`]: npath.fromPortablePath(
      ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/tsserver.js` as PortablePath,
        ),
      ),
    ),
  });
};

export const generateEslintWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const wrapper = new Wrapper(`eslint` as PortablePath, {projectRoot, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/eslint.js` as PortablePath);
  await wrapper.writeFile(`lib/api.js` as PortablePath);

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/api.js` as PortablePath,
        ),
      ))),
    ),
  });
};

export const generatePrettierWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const wrapper = new Wrapper(`prettier` as PortablePath, {projectRoot, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`index.js` as PortablePath);

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`prettier.prettierPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `index.js` as PortablePath,
      ),
    ),
  });
};

const isPackageInstalled = (name: string): boolean => {
  try {
    dynamicRequire.resolve(name);
    return true;
  } catch (e) {
    if (e.code && e.code === `MODULE_NOT_FOUND`) {
      return false;
    } else  {
      throw e;
    }
  }
};

const SDKS: Array<[string, (projectRoot: PortablePath, target: PortablePath) => Promise<void>]> = [
  [`typescript`, generateTypescriptWrapper],
  [`eslint`, generateEslintWrapper],
  [`prettier`, generatePrettierWrapper],
];

export const generateSdk = async (projectRoot: PortablePath): Promise<any> => {
  const targetFolder = ppath.join(projectRoot, `.vscode/pnpify` as PortablePath);

  let generatedSomething = false;

  if (xfs.existsSync(targetFolder)) {
    console.log(`Cleaning the existing SDKs...`);
    await xfs.removePromise(targetFolder);

    generatedSomething = true;
  }

  for (const [pkgName, generateWrapper] of SDKS) {
    if (!isPackageInstalled(pkgName))
      continue;

    console.log(`Installing the SDK for ${pkgName}...`);
    await generateWrapper(projectRoot, targetFolder);

    generatedSomething = true;
  }

  if (!generatedSomething) {
    console.log(`Nothing to do.`);
  }
};
