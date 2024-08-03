import fs from 'node:fs';

const listContent = fs
  .readdirSync(new URL(`../.github/workflows`, import.meta.url))
  .filter(name => name.startsWith(`e2e-`))
  .sort()
  .map(
    name =>
      `- [![](https://github.com/yarnpkg/berry/actions/workflows/${name}/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/${name})`,
  )
  .join(`\n`);

const START_MARKER = `<!-- start generated list -->`;
const END_MARKER = `<!-- end generated list -->`;

const currentReadme = fs.readFileSync(new URL(`../README.md`, import.meta.url), `utf8`);

const startIndex = currentReadme.indexOf(START_MARKER);
if (startIndex === -1) throw new Error(`Could not find start marker in README.md`);

const endIndex = currentReadme.indexOf(END_MARKER);
if (endIndex === -1) throw new Error(`Could not find end marker in README.md`);

const updatedReadme = `${currentReadme.slice(
  0,
  startIndex + START_MARKER.length,
)}\n${listContent}\n${currentReadme.slice(endIndex)}`;

if (currentReadme !== updatedReadme) {
  fs.writeFileSync(new URL(`../README.md`, import.meta.url), updatedReadme);
  console.log(`Updated README.md`);
} else {
  console.log(`README.md is already up to date`);
}
