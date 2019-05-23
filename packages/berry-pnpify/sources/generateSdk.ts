import {Filename, NodeFS, PortablePath, xfs, ppath} from '@berry/fslib';

const TEMPLATE = (relPnpApiPath: string) => [
  `const relPnpApiPath = ${JSON.stringify(NodeFS.toPortablePath(relPnpApiPath))};\n`,
  `const absPnpApiPath = require(\`path\`).resolve(__dirname, relPnpApiPath);\n`,
  `\n`,
  `// Setup the environment to be able to require @berry/pnpify\n`,
  `require(absPnpApiPath).setup();\n`,
  `\n`,
  `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
  `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${absPnpApiPath}\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@berry/pnpify/lib\`)}\`;\n`,
  `\n`,
  `// Apply PnPify to the current process\n`,
  `require(\`@berry/pnpify/lib\`).patchFs();\n`,
  `\n`,
  `// Defer to the real typescript your application uses\n`,
  `require(\`typescript/lib/tsserver\`);\n`,
].join(``);

export async function generateSdk(projectRoot: PortablePath, targetFolder: PortablePath | null) {
  if (targetFolder === null)
    targetFolder = projectRoot;

  const tssdk = ppath.join(targetFolder, `tssdk` as PortablePath);
  const tssdkManifest = ppath.join(tssdk, `package.json` as PortablePath);
  const tsserver = ppath.join(tssdk, `lib/tsserver.js` as PortablePath);

  const relPnpApiPath = ppath.relative(ppath.dirname(tsserver), ppath.join(projectRoot, `.pnp.js` as Filename));

  await xfs.removePromise(tssdk);
  await xfs.mkdirpPromise(ppath.dirname(tsserver));
  await xfs.writeFilePromise(tssdkManifest, JSON.stringify({name: 'typescript', version: `${require('typescript/package.json').version}-pnpify`}, null, 2));
  await xfs.writeFilePromise(tsserver, TEMPLATE(relPnpApiPath));

  const settings = ppath.join(projectRoot, `.vscode/settings.json` as PortablePath);
  const content = await xfs.existsPromise(settings) ? await xfs.readFilePromise(settings, `utf8`) : ``;

  const data = JSON.parse(content);
  data[`typescript.tsdk`] = NodeFS.fromPortablePath(ppath.relative(projectRoot, ppath.dirname(tsserver)));
  const patched = `${JSON.stringify(data, null, 2)}\n`;

  await xfs.mkdirpPromise(ppath.dirname(settings));
  await xfs.changeFilePromise(settings, patched);
}
