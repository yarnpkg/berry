const cp = require(`child_process`);
const crypto = require(`crypto`);
const fs = require(`fs`);
const https = require(`https`);
const path = require(`path`);
const semver = require(`semver`);

const TS_REPO = `/tmp/ts-repo`;
const TS_REPO_SPAWN = {cwd: TS_REPO};

const TMP_DIR = `/tmp/ts-builds`;

const IGNORED_VERSIONS = new Set([
  `3.3.3333`,
]);

const SLICES = [
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `e39bdc3`,
    range: `>=3.2 <3.5`,
  },
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `cf7b2d4`,
    range: `>=3.5 <=3.6`,
  },
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `cda54b8`,
    range: `>3.6 <3.7`,
  },
  {
    from: `5d50de3`,
    to: `2f85932`,
    onto: `e39bdc3`,
    range: `>=3.7 <3.9`,
  },
  {
    from: `5d50de3`,
    to: `3af06df`,
    onto: `551f0dd`,
    range: `>=3.9 <4.0`,
  },
  {
    from: `6dbdd2f`,
    to: `6dbdd2f`,
    onto: `56865f7`,
    range: `>=4.0 <4.1`,
  },
  {
    from: `746d79b`,
    to: `746d79b`,
    onto: `69972a3`,
    range: `>=4.1 <4.2`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.2
  {
    from: `8e0e8703b9c95013aec7819e4593d099cdf7763a`,
    to: `178a67b4663d80b0fcbea542e7255b4499b51708`,
    onto: `bfc55b5762443c37ecdef08a3b5a4e057b4d1e85`,
    range: `>=4.2 <4.3`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.3
  {
    from: `530aad19e4ac19d35cb6b200168c91ce86cb0050`,
    to: `ffa54c5a104e7940b5c23666ddffbf44878f9d9f`,
    onto: `28e3e6ff2f49f1dbf06d31809ec73dbe42f1aa63`,
    range: `>=4.3 <4.4`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.4
  {
    from: `793bfe32745bf6797924354b0fd5be62cf01950c`,
    to: `20ffca2f3c48591c971e6606a55b7b1820d8a64f`,
    onto: `a10409ccaa3604790dc45f52ef0402eb49015dcf`,
    range: `>=4.4 <4.5`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.5
  {
    from: `79fe5d206f89e5f1585807bdcd7feeb567a69646`,
    to: `fff89a12766fa485e35b1c65d8631d109c4e2c0e`,
    onto: `7893f689fedcfe28a499d119d34844840bce9160`,
    range: `>=4.5.2 <4.6`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.6
  {
    from: `b8468c021393b2c36d6828ff2d3fc8665e09fd73`,
    to: `b8468c021393b2c36d6828ff2d3fc8665e09fd73`,
    onto: `40c4fac04935b84f16e8fed8ce730a86b330ba12`,
    range: `>=4.6.0-beta`,
  },
];

async function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (!(res.statusCode >= 200 && res.statusCode < 300))
        throw new Error(`Failed to fetch ${url}`);

      const chunks = [];

      res.on(`error`, err => {
        reject(err);
      });

      res.on(`data`, chunk => {
        chunks.push(chunk);
      });

      res.on(`end`, () => {
        resolve(Buffer.concat(chunks));
      });
    });

    req.on(`error`, err => {
      reject(err);
    });
  });
}

async function execFile(binary, args, {checkExitCode = true, ...opts} = {}) {
  console.log(`${binary} ${args.join(` `)}`);

  return new Promise((resolve, reject) => {
    const child = cp.spawn(binary, args, opts);

    const outChunks = [];
    const allChunks = [];

    child.stdout.on(`data`, chunk => {
      outChunks.push(chunk);
      allChunks.push(chunk);
    });

    child.stderr.on(`data`, chunk => {
      allChunks.push(chunk);
    });

    child.on(`error`, err => {
      err.message += `\n\n${Buffer.concat(allChunks).toString()}\n`;
      reject(err);
    });

    child.on(`close`, code => {
      if (code === 0 || !checkExitCode) {
        resolve(Buffer.concat(outChunks));
      } else {
        reject(new Error(`The process exited\n\n${Buffer.concat(allChunks).toString()}\n`));
      }
    });
  });
}

let relevantVersions;

async function fetchVersions(range) {
  if (typeof relevantVersions === `undefined`) {
    const data = await fetch(`https://registry.yarnpkg.com/typescript`);
    const allVersions = Object.keys(JSON.parse(data.toString()).versions);

    relevantVersions = [];

    let highestPre;
    for (const version of allVersions) {
      if (IGNORED_VERSIONS.has(version))
        continue;

      const pre = semver.prerelease(version);
      if (pre) {
        if (pre[0] !== `beta` && pre[0] !== `rc`)
          continue;

        if (!highestPre || semver.gt(version, highestPre)) {
          highestPre = version;
        }
      } else {
        relevantVersions.push(version);
      }
    }

    if (highestPre) {
      relevantVersions.push(highestPre);
    }
  }

  const versions = [];

  for (const version of relevantVersions) {
    const parsed = semver.parse(version);

    const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    if (!semver.satisfies(base, range))
      continue;

    versions.push(version);
  }

  return versions;
}

async function cloneRepository() {
  if (!fs.existsSync(TS_REPO)) {
    await execFile(`git`, [`clone`, `https://github.com/arcanis/typescript`, TS_REPO]);
    await execFile(`git`, [`remote`, `add`, `upstream`, `https://github.com/microsoft/typescript`], TS_REPO_SPAWN);
    await execFile(`git`, [`remote`, `add`, `upstream2`, `https://github.com/merceyz/typescript`], TS_REPO_SPAWN);
  }

  try {
    await execFile(`git`, [`cherry-pick`, `--abort`], TS_REPO_SPAWN);
  } catch {}

  await execFile(`git`, [`config`, `user.email`, `you@example.com`], TS_REPO_SPAWN);
  await execFile(`git`, [`config`, `user.name`, `Your Name`], TS_REPO_SPAWN);

  await execFile(`git`, [`fetch`, `origin`], TS_REPO_SPAWN);
  await execFile(`git`, [`fetch`, `upstream`], TS_REPO_SPAWN);
  await execFile(`git`, [`fetch`, `upstream2`], TS_REPO_SPAWN);
}

async function resetGit(hash) {
  await execFile(`git`, [`reset`, `--hard`, hash], TS_REPO_SPAWN);
  await execFile(`git`, [`clean`, `-df`], TS_REPO_SPAWN);

  if (fs.existsSync(path.join(TS_REPO, `package-lock.json`))) {
    await execFile(`npm`, [`install`], TS_REPO_SPAWN);
  } else {
    const date = await execFile(`git`, [`show`, `-s`, `--format=%ci`], TS_REPO_SPAWN);
    await execFile(`npm`, [`install`, `--before`, date.toString().trim()], TS_REPO_SPAWN);
  }
}

async function buildRepository({from, to, onto}) {
  const code = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, `0`);
  const tmpDir = path.join(TMP_DIR, `${code}`);

  await resetGit(onto);

  if (to) {
    let isAncestor;
    try {
      await execFile(`git`, [`merge-base`, `--is-ancestor`, onto, to], TS_REPO_SPAWN);
      isAncestor = true;
    } catch {
      isAncestor = false;
    }

    if (isAncestor) {
      await execFile(`git`, [`merge`, `--no-edit`, to], TS_REPO_SPAWN);
    } else {
      await execFile(`git`, [`cherry-pick`, `${from}^..${to}`], TS_REPO_SPAWN);
    }
  }

  await execFile(`./node_modules/.bin/gulp`, [`local`, `LKG`], TS_REPO_SPAWN);

  // It seems that in some circumstances the build can produce incorrect artifacts. When
  // that happens, the final binary is very small. We try to detect that.
  const stat = await fs.promises.stat(path.join(TS_REPO, `lib/typescript.js`));
  if (stat.size < 100000)
    throw new Error(`Something is wrong; typescript.js got generated with a stupid size`);

  await fs.promises.mkdir(tmpDir, {recursive: true});
  await execFile(`cp`, [`-r`, `lib`, tmpDir], TS_REPO_SPAWN);

  await execFile(`rm`, [`-rf`, `lib`], TS_REPO_SPAWN);
  await execFile(`git`, [`reset`, `--hard`], TS_REPO_SPAWN);

  return tmpDir;
}

async function run({from, to, onto, range}) {
  const hash = crypto
    .createHash(`md5`)
    .update(JSON.stringify({from, to, onto, range}))
    .digest(`hex`);

  const patchFile = path.join(__dirname, `patch-${hash}.diff`);
  if (fs.existsSync(patchFile)) {
    console.log(`Skipping; file ${path.basename(patchFile)} already exists`);
    return patchFile;
  }

  await cloneRepository();

  const base = await buildRepository({onto});
  const patched = await buildRepository({from, to, onto});

  const buffer = await execFile(`git`, [`diff`, `--no-index`, base, patched], {checkExitCode: false});

  let patch = buffer.toString();
  patch = patch.replace(/^--- /gm, `semver exclusivity ${range}\n--- `);
  patch = patch.replace(new RegExp(`${base}/`, `g`), `/`);
  patch = patch.replace(new RegExp(`${patched}/`, `g`), `/`);
  patch = patch.replace(new RegExp(`${patched}/`, `g`), `/`);

  await fs.promises.writeFile(patchFile, patch);

  return patchFile;
}

async function validate(version, patchFile) {
  const tmpDir = path.join(TMP_DIR, `v${version}`);
  const tarball = path.join(tmpDir, `package.tgz`);

  await fs.promises.mkdir(tmpDir, {recursive: true});

  if (!fs.existsSync(tarball)) {
    const data = await fetch(`https://registry.yarnpkg.com/typescript/-/typescript-${version}.tgz`);
    await fs.promises.writeFile(tarball, data);
  }

  if (!fs.existsSync(path.join(tmpDir, `package`)))
    await execFile(`tar`, [`xvf`, tarball], {cwd: tmpDir});

  let patch = await fs.promises.readFile(patchFile, `utf8`);
  patch = patch.replace(/^semver .*\n/gm, ``);
  await fs.promises.writeFile(path.join(tmpDir, `patch.diff`), patch);

  await execFile(`git`, [`apply`, `--check`, `../patch.diff`], {cwd: path.join(tmpDir, `package`)});
}

async function main() {
  const patchFiles = [];
  let isFirst = true;

  for (const slice of SLICES) {
    if (!isFirst)
      console.log();

    isFirst = false;

    console.log(`## Slice: ${JSON.stringify(slice)}`);
    console.log();

    const patchFile = await run(slice);
    const versions = await fetchVersions(slice.range);

    for (const version of versions) {
      console.log(`Validating ${version}...`);
      await validate(version, patchFile);
    }

    patchFiles.push(patchFile);
  }

  const patches = await Promise.all(patchFiles.map(patchFile => {
    return fs.promises.readFile(patchFile, `utf8`);
  }));

  const aggregatePatchFile = path.join(TMP_DIR, `patch.diff`);
  await fs.promises.writeFile(aggregatePatchFile, patches.join(``));

  const jsPatchFile = path.join(__dirname, `../../sources/patches/typescript.patch.ts`);
  await execFile(`node`, [path.join(__dirname, `../createPatch.js`), aggregatePatchFile, jsPatchFile]);

  // Remove old patches
  const patchFilesSet = new Set(patchFiles);
  for await (const {name: patchName} of await fs.promises.opendir(__dirname)) {
    if (patchName.endsWith(`.diff`) && !patchFilesSet.has(path.join(__dirname, patchName))) {
      console.log(`Cleanup; file ${patchName} not in use`);
      await fs.promises.unlink(path.join(__dirname, patchName));
    }
  }
}

main().catch(err => {
  console.error(err.stack);
  process.exitCode = 1;
});
