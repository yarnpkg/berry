const fs = require(`fs`);
const path = require(`path`);

const statePath = path.join(__dirname, `stable-versions-store.json`);
const state = JSON.parse(fs.readFileSync(statePath, `utf8`));

for (const [pkgJsonPath, version] of Object.entries(state)) {
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

  pkgJson.stableVersion = version;

  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
}

fs.unlinkSync(path.join(__dirname, `stable-versions-store.json`));
