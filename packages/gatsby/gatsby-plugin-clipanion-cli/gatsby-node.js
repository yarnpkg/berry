const {execFileSync}  = require(`child_process`);

exports.sourceNodes = ({actions, createNodeId, createContentDigest}, opts) => {
  const {createNode} = actions;

  for (const {binary, namespace} of opts.binaries) {
    const namespaceLeadingSlash = namespace ? `/${namespace}` : ``;
    const namespaceTrailingSlash = namespace ? `${namespace}/` : ``;

    const output = execFileSync(`node`, [binary, `--clipanion=definitions`]);

    let commands;
    try {
      commands = JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to parse "${output}"`);
    }

    for (let t = 0; t < commands.length; ++t) {
      const command = commands[t];
      const sections = [];

      const url = command.path.split(` `).slice(1).join(`/`) || `default`;

      const description = `${command.description[0].toUpperCase()}${command.description.slice(1, -1)}.`;

      sections.push([
        `---\n`,
        `category: ${namespaceTrailingSlash}cli\n`,
        `path: ${namespaceLeadingSlash}/cli/${url}\n`,
        `title: "\`${command.path}\`"\n`,
        `description: ${JSON.stringify(description)}\n`,
        `---\n`,
      ].join(``));

      if (command.plugin && !command.plugin.isDefault) {
        const [, pluginName] = /^@yarnpkg\/plugin-(.+)$/.exec(command.plugin.name);

        sections.push([
          `> **Plugin**\n`,
          `>\n`,
          `> To use this command, first install the \`${pluginName}\` plugin: \`yarn plugin import ${pluginName}\`\n`,
        ].join(``));
      }

      if (command.description) {
        sections.push([
          `${description}\n`,
        ].join(``));
      }

      sections.push([
        `## Usage\n`,
        `\n`,
        `\`\`\`\n`,
        `$> ${command.usage}\n`,
        `\`\`\`\n`,
      ].join(``));

      if (command.examples && command.examples.length > 0) {
        sections.push([
          `## Examples\n`,
          `\n`,
          ...command.examples.map(([description, example]) => [
            `${description}:\n`,
            `\`\`\`\n`,
            `${example}\n`,
            `\`\`\`\n`,
          ].join(``)),
        ].join(``));
      }

      if (command.options.length > 0) {
        const addAnchor = definition => `<h3 id="${encodeURIComponent((`options-${definition}`).replace(/\-+/g, `-`))}" class="header-code"><code class="language-text">${definition}</code></h3>`;
        sections.push([
          `## Options\n`,
          `\n`,
          `| <div style="width:180px">Definition</div> | Description |\n`,
          `| ---------- | ----------- |\n`,
          ...command.options.map(
            ({definition, description}) => `| ${addAnchor(definition)} | ${description} |\n`
          ),
        ].join(``));
      }

      if (command.details) {
        sections.push([
          `## Details\n`,
          `\n`,
          `${command.details}\n`,
        ].join(``));
      }


      const content = sections.join(`\n`);
      const contentDigest = createContentDigest(content);

      createNode({
        ...command,
        id: createNodeId(command.path),
        parent: null,
        children: [],
        internal: {
          type: `TextNode`,
          mediaType: `text/markdown`,
          content,
          contentDigest,
        },
      });
    }
  }
};
