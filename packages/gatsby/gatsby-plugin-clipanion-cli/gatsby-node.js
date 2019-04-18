const {execFileSync}  = require(`child_process`);

exports.sourceNodes = ({actions, createNodeId, createContentDigest}, opts) => {
  const {createNode} = actions;
  const {commands} = JSON.parse(execFileSync(`node`, [opts.binary, `--clipanion-definitions`]));

  for (let t = 0; t < commands.length; ++t) {
    const command = commands[t];
    const sections = [];

    sections.push([
      `---\n`,
      `category: cli\n`,
      `path: /cli/${command.path.join(`/`)}\n`,
      `title: "\`${opts.argv0} ${command.path.join(` `)}\`"\n`,
      `---\n`,
    ].join(``));

    if (command.description) {
      sections.push([
        `${command.description[0].toUpperCase()}${command.description.slice(1, -1)}.\n`
      ].join(``));
    }

    sections.push([
      `## Usage\n`,
      `\n`,
      `\`\`\`\n`,
      `$> ${[opts.argv0].concat(command.path).join(` `)} ${command.usage}\n`,
      `\`\`\`\n`,
    ].join(``));

    if (command.details) {
      sections.push([
        `## Details\n`,
        `\n`,
        `${command.details}\n`,
      ].join(``));
    }

    if (command.examples.length > 0) {
      sections.push([
        `## Examples\n`,
        `\n`,
        ... command.examples.map(({description, example}) => [
          `${description}:\n`,
          `\`\`\`\n`,
          `${example}\n`,
          `\`\`\`\n`,
        ].join(``)),
      ].join(``));
    }

    const content = sections.join(`\n`);
    const contentDigest = createContentDigest(content);

    createNode({
      ... commands[t],
      id: createNodeId(t),
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
};
