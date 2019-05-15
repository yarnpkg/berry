import {NodeFS, PortablePath, xfs, ppath} from '@berry/fslib';

const TEMPLATE = [
  `// Locate the top-level PnP api\n`,
  `const {PnPApiLocator} = require('@berry/pnpify');\n`,
  `const pnpApiPath = new PnPApiLocator().findApi(__dirname);\n`,
  `\n`,
  `// If we don't find one, something is off\n`,
  `if (!pnpApiPath)\n`,
  `  throw new Error(\`Couldn't locate the PnP API to use with the SDK\`);\n`,
  `\n`,
  `// Setup the environment to be able to require @berry/pnpify\n`,
  `require(pnpApiPath).setup();\n`,
  `\n`,
  `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
  `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${pnpApiPath}\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@berry/pnpify\`)}\`;\n`,
  `\n`,
  `// Apply PnPify to the current process\n`,
  `require(\`@berry/pnpify\`).patchFs();\n`,
  `\n`,
  `// Defer to the real typescript your application uses\n`,
  `require(\`typescript/lib/tsserver\`);\n`,
].join(``);

export async function generateSdk(projectRoot: PortablePath, targetFolder: PortablePath | null) {
  if (targetFolder === null)
    targetFolder = projectRoot;

  const tssdk = ppath.join(targetFolder, `tssdk` as PortablePath);
  const tsserver = ppath.join(tssdk, `lib/tsserver.js` as PortablePath);

  await xfs.removePromise(tssdk);
  await xfs.mkdirpPromise(ppath.dirname(tsserver));
  await xfs.writeFilePromise(tsserver, TEMPLATE);

  const settings = ppath.join(projectRoot, `.vscode/settings.json` as PortablePath);
  const content = await xfs.existsPromise(settings) ? await xfs.readFilePromise(settings, `utf8`) : ``;

  const data = JSON.parse(content);
  data[`typescript.sdk`] = NodeFS.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(tsserver)));
  const patched = JSON.stringify(data, null, 2);

  await xfs.mkdirpPromise(ppath.join(projectRoot, ppath.dirname(settings)));
  await xfs.changeFilePromise(settings, patched);
}
