import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import CJSON                                       from 'comment-json';

import {dynamicRequire}                            from './dynamicRequire';

const TEMPLATE = (relPnpApiPath: PortablePath, module: string, {usePnpify}: {usePnpify: boolean}) => [
  `const {createRequire, createRequireFromPath} = require(\`module\`);\n`,
  `const {dirname, resolve} = require(\`path\`);\n`,
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

const generateTypescriptWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const typescript = ppath.join(target, `typescript` as PortablePath);
  const manifest = ppath.join(typescript, `package.json` as PortablePath);
  const tsserver = ppath.join(typescript, `lib/tsserver.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(tsserver), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.mkdirpPromise(ppath.dirname(tsserver));
  await xfs.writeFilePromise(manifest, JSON.stringify({name: `typescript`, version: `${dynamicRequire(`typescript/package.json`).version}-pnpify`}, null, 2));
  await xfs.writeFilePromise(tsserver, TEMPLATE(relPnpApiPath, `typescript/lib/tsserver`, {usePnpify: false}));

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`typescript.tsdk`]: npath.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(tsserver))),
  });
};

export const generateEslintWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const eslint = ppath.join(target, `eslint` as PortablePath);
  const manifest = ppath.join(eslint, `package.json` as PortablePath);
  const api = ppath.join(eslint, `lib/api.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(api), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.mkdirpPromise(ppath.dirname(api));
  await xfs.writeFilePromise(manifest, JSON.stringify({name: `eslint`, version: `${dynamicRequire(`eslint/package.json`).version}-pnpify`, main: `lib/api.js`}, null, 2));
  await xfs.writeFilePromise(api, TEMPLATE(relPnpApiPath, `eslint`, {usePnpify: false}));

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`eslint.nodePath`]: npath.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(eslint))),
  });
};

export const generatePrettierWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const prettier = ppath.join(target, `prettier` as PortablePath);
  const manifest = ppath.join(prettier, `package.json` as PortablePath);
  const api = ppath.join(prettier, `index.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(api), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.mkdirpPromise(ppath.dirname(api));
  await xfs.writeFilePromise(manifest, JSON.stringify({name: `prettier`, version: `${dynamicRequire(`prettier/package.json`).version}-pnpify`, main: `index.js`}, null, 2));
  await xfs.writeFilePromise(api, TEMPLATE(relPnpApiPath, `prettier`, {usePnpify: false}));

  await addVSCodeWorkspaceSettings(projectRoot, {
    [`prettier.prettierPath`]: npath.fromPortablePath(ppath.relative(projectRoot, prettier)),
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
