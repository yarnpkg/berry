```js repro
const fs = require('fs').promises;

await packageJsonAndInstall({
  "name": "root",
  "workspaces": [
    "packages/*"
  ],
  "dependencies": {
    "rimraf": "^1.0.0"
  },
});

await fs.mkdir('packages/ws', { recursive: true });
await fs.writeFile("packages/ws/package.json", `{
  "dependencies": {
    "rimraf": "^2.0.0"
  },
  "name": "ws"
}`);

await yarn(`install`);

const rootRimrafPath = await yarn(`bin`, `rimraf`)
const workspaceRimrafPath = await yarn(`workspace`, `ws`, `bin`, `rimraf`);

expect(rootRimrafPath).not.toEqual(workspaceRimrafPath);
```
