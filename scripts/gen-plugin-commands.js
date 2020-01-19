require(`./setup-ts-execution`);

const {Cli} = require(`clipanion`);
const fs = require(`fs`);
const path = require(`path`);

const root = `${__dirname}/../packages`;
const folders = fs.readdirSync(root);

let output = ``;

output += `// Don't modify this script directly! Instead, run:\n`;
output += `// yarn build:plugin-commands\n`;
output += `\n`;
output += `export const pluginCommands = new Map([\n`;

for (const name of folders) {
  if (!name.startsWith(`plugin-`))
    continue;

  const manifest = require(path.join(root, name, `package.json`));
  if (!manifest.scripts[`update-local`])
    continue;

  const index = require(path.join(root, name));
  const commands = index.default.commands;

  const cli = new Cli();

  for (const command of commands || [])
    cli.register(command);

  const defs = cli.definitions();
  if (defs.length === 0)
    continue;

  output += `  [\`${manifest.name.replace(/^@yarnpkg\/plugin-/, ``)}\`, [\n`;

  for (const {path} of defs)
    output += `    [${path.replace(/^\.\.\.\s+/, ``).split(/\s+/).map(p => `\`${p}\``).join(`, `)}],\n`;

  output += `  ]],\n`;
}

output += `]);\n`;

process.stdout.write(output);
