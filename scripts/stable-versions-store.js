const fs = require(`fs`);
const path = require(`path`);

const stableVersions = {};

const packageDirPath = path.join(__dirname, `../packages`);
for (const folderName of fs.readdirSync(packageDirPath)) {
  const pkgJsonPath = path.join(folderName, `package.json`);

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, `utf8`));
  if (!pkgJson.version)
    continue;

  stableVersions[pkgJsonPath] = pkgJson.version;
}

fs.writeFileSync(path.join(__dirname, `stable-versions-store.json`), `${JSON.stringify(stableVersions, null, 2)}\n`);
