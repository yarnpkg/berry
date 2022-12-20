require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

const {ppath, npath} = require(`@yarnpkg/fslib`);
const {mountMemoryDrive} = require(`@yarnpkg/libzip`);
const {execFileSync} = require(`child_process`);
const {constants} = require(`fs`);

const memoryDrive = mountMemoryDrive(
  require(`fs`),
  ppath.join(npath.toPortablePath(__dirname), `docs/cli`),
  null,
  {typeCheck: constants.S_IFDIR},
);

const binaries = [{
  package: `@yarnpkg/cli`,
  binary: `${__dirname}/../../scripts/run-yarn.js`,
}, {
  package: `@yarnpkg/builder`,
  binary: `${__dirname}/../../scripts/run-builder.js`,
}, {
  package: `@yarnpkg/pnpify`,
  binary: `${__dirname}/../../scripts/run-pnpify.js`,
}, {
  package: `@yarnpkg/sdks`,
  binary: `${__dirname}/../../scripts/run-sdks.js`,
}];

for (const [position, {binary, package}] of binaries.entries()) {
  const isMainPackage = package === `@yarnpkg/cli`;
  const packageParts = package?.match(/^(?:@([^/]+?)\/)?([^/]+)$/);

  const [, scope, name] = packageParts ?? [];

  const docFolder = name.replace(/\//g, `-`);
  memoryDrive.mkdirSync(docFolder);

  const docUrl = isMainPackage
    ? `/cli`
    : `/${name}/cli`;

  const output = execFileSync(`yarn`, [`node`, binary, `--clipanion=definitions`], {
    env: {...process.env, NODE_OPTIONS: undefined},
  });

  let commands;
  try {
    commands = JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to parse "${output}"`);
  }

  commands.sort((a, b) => {
    return a.path < b.path ? -1 : a.path > b.path ? +1 : 0;
  });

  for (let t = 0; t < commands.length; ++t) {
    const command = commands[t];
    const sections = [];

    const pathSegments = command.path.split(` `);
    if (!isMainPackage)
      pathSegments.unshift(`yarn`);

    const navPath = `${docUrl}/${command.path.split(` `).slice(1).join(`/`) || `default`}`;
    const description = `${command.description[0].toUpperCase()}${command.description.slice(1, -1)}.`;

    const id = `cli-${command.path.replace(/ /g, `-`)}`;

    sections.push([
      `---\n`,
      `id: ${JSON.stringify(id)}\n`,
      `slug: ${JSON.stringify(navPath)}\n`,
      `title: ${JSON.stringify(pathSegments.join(` `))}\n`,
      `description: ${JSON.stringify(description)}\n`,
      `---\n`,
      `\n`,
      `import {TerminalCode} from '@yarnpkg/docusaurus/src/components/TerminalCode';`,
      `\n`,
    ].join(``));

    if (command.plugin && !command.plugin.isDefault) {
      const [, pluginName] = /^@yarnpkg\/plugin-(.+)$/.exec(command.plugin.name);

      sections.push([
        `:::note\n`,
        `To use this command, first install the [\`${pluginName}\`](https://github.com/yarnpkg/berry/blob/HEAD/packages/plugin-${pluginName}/README.md) plugin: \`yarn plugin import ${pluginName}\`\n`,
        `:::\n`,
      ].join(``));
    }

    if (!isMainPackage) {
      sections.push([
        `:::note\n`,
        `To use this command, you need to use the [\`${package}\`](https://github.com/yarnpkg/berry/blob/HEAD/packages/${scope}-${name}/README.md) package either:\n`,
        `- By installing it locally using [\`yarn add\`](/cli/add) and running it using [\`yarn run\`](/cli/run)\n`,
        `- By downloading and running it in a temporary environment using [\`yarn dlx\`](/cli/dlx)\n`,
        `:::\n`,
      ].join(``));
    }

    if (command.description) {
      sections.push([
        `<div className="subtitle">\n`,
        `\n`,
        `${description}\n`,
        `\n`,
        `</div>\n`,
      ].join(``));
    }

    sections.push([
      `## Usage\n`,
      `\n`,
      `<TerminalCode command={${JSON.stringify(`${!isMainPackage ? `yarn ` : ``}${command.usage}`)}}/>\n`,
    ].join(``));

    if (command.examples && command.examples.length > 0) {
      sections.push([
        `## Examples\n`,
        `\n`,
        ...command.examples.map(([description, example]) => [
          `<p>${description}:</p>\n`,
          `\n`,
          `<TerminalCode command={${JSON.stringify(example)}}/>\n`,
        ].join(`\n`)),
      ].join(``));
    }

    if (command.details) {
      sections.push([
        `## Details\n`,
        `\n`,
        `${command.details}\n`,
      ].join(``));
    }

    if (command.options.length > 0) {
      const addAnchor = definition => `<h4 id="${encodeURIComponent((`options-${definition}`).replace(/-+/g, `-`))}" className="header-code"><code className="language-text">${definition}</code></h4>`;
      sections.push([
        `## Options\n`,
        `\n`,
        `<div className="option-table"></div>`,
        `\n`,
        `\n`,
        `| Definition | Description |\n`,
        `| ---------- | ----------- |\n`,
        ...command.options.map(
          ({definition, description}) => `| ${addAnchor(definition)} | ${description} |\n`,
        ),
        `\n`,
      ].join(``));
    }

    const content = sections.join(`\n`);
    const filePath = ppath.join(docFolder, `${id}.md`);

    memoryDrive.writeFileSync(filePath, content);
  }

  memoryDrive.writeJsonSync(ppath.join(docFolder, `_category_.json`), {
    label: package,
    collapsible: false,
    position,
    link: {
      type: `generated-index`,
      title: package,
      slug: `/${docUrl}`,
    },
  });
}
