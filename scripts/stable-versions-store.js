const fs = require(`fs`);
const path = require(`path`);

const stableVersions = {};

const packageDirPath = path.join(__dirname, `../packages`);
for (const folderName of fs.readdirSync(packageDirPath)) {
  const pkgJsonPath = path.join(packageDirPath, folderName, `package.json`);

  let pkgJson;
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, `utf8`));
    if (!pkgJson.version) {
      continue;
    }
  } catch (err) {
    if (err.code === `ENOENT`) {
      continue;
    } else {
      throw err;
    }
  }

  stableVersions[pkgJsonPath] = pkgJson.version;
}

fs.writeFileSync(path.join(__dirname, `stable-versions-store.json`), `${JSON.stringify(stableVersions, null, 2)}\n`);
