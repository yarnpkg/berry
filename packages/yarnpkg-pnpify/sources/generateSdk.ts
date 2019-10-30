import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import CJSON                                       from 'comment-json';

import {dynamicRequire}                            from './dynamicRequire';

const TEMPLATE = (relPnpApiPath: string, module: string, {usePnpify}: {usePnpify: boolean}) => [
  `const relPnpApiPath = ${JSON.stringify(npath.toPortablePath(relPnpApiPath))};\n`,
  `const absPnpApiPath = require(\`path\`).resolve(__dirname, relPnpApiPath);\n`,
  `\n`,
  `// Setup the environment to be able to require ${module}\n`,
  `require(absPnpApiPath).setup();\n`,
  `\n`,
  `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
  `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${absPnpApiPath}\`;\n`,
  ...(usePnpify ? [
    `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@yarnpkg/pnpify\`)}\`;\n`,
    `\n`,
    `// Apply PnPify to the current process\n`,
    `require(\`@yarnpkg/pnpify\`).patchFs();\n`,
  ] : []),
  `\n`,
  `// Defer to the real ${module} your application uses\n`,
  `module.exports = require(\`${module}\`);\n`,
].join(``);

const addVSCodeWorkspaceSettings = async (projectRoot: PortablePath, settings: any) => {
  const settingsPath = ppath.join(projectRoot, `.vscode/settings.json` as PortablePath);
  const content = await xfs.existsPromise(settingsPath) ? await xfs.readFilePromise(settingsPath, `utf8`) : `{}`;

  const data = CJSON.parse(content);
  const patched = `${CJSON.stringify({...data, ...settings}, null, 2)}\n`;

  await xfs.mkdirpPromise(ppath.dirname(settingsPath));
  await xfs.changeFilePromise(settingsPath, patched);
};

const generateTypescriptWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const typescript = ppath.join(target, `typescript` as PortablePath);
  const manifest = ppath.join(typescript, `package.json` as PortablePath);
  const tsserver = ppath.join(typescript, `lib/tsserver.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(tsserver), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.mkdirpPromise(ppath.dirname(tsserver));
  await xfs.writeFilePromise(manifest, JSON.stringify({name: 'typescript', version: `${dynamicRequire('typescript/package.json').version}-pnpify`}, null, 2));
  await xfs.writeFilePromise(tsserver, TEMPLATE(relPnpApiPath, "typescript/lib/tsserver", {usePnpify: true}));

  await addVSCodeWorkspaceSettings(projectRoot, {'typescript.tsdk': npath.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(tsserver)))});
};

export const generateEslintWrapper = async (projectRoot: PortablePath, target: PortablePath) => {
  const eslint = ppath.join(target, `eslint` as PortablePath);
  const manifest = ppath.join(eslint, `package.json` as PortablePath);
  const api = ppath.join(eslint, `lib/api.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(api), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.mkdirpPromise(ppath.dirname(api));
  await xfs.writeFilePromise(manifest, JSON.stringify({name: 'eslint', version: `${dynamicRequire('eslint/package.json').version}-pnpify`, main: 'lib/api.js'}, null, 2));
  await xfs.writeFilePromise(api, TEMPLATE(relPnpApiPath, "eslint", {usePnpify: false}));

  await addVSCodeWorkspaceSettings(projectRoot, {'eslint.nodePath': npath.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(eslint)))});
};

const isPackageInstalled = (name: string): boolean => {
  try {
    dynamicRequire.resolve(name);
    return true;
  } catch (e) {
    if (e.code && e.code === 'MODULE_NOT_FOUND') {
      return false;
    } else  {
      throw e;
    }
  }
};

export const generateSdk = async (projectRoot: PortablePath): Promise<any> => {
  const hasTypescript = isPackageInstalled('typescript');
  const hasEslint = isPackageInstalled('eslint');

  const targetFolder = ppath.join(projectRoot, `.vscode/pnpify` as PortablePath);

  if (!hasTypescript && !hasEslint)
    console.warn(`Neither 'typescript' nor 'eslint' are installed. Nothing to do.`);
  else
    await xfs.removePromise(targetFolder);

  if (hasTypescript)
    await generateTypescriptWrapper(projectRoot, targetFolder);

  if (hasEslint) {
    await generateEslintWrapper(projectRoot, targetFolder);
  }
};
