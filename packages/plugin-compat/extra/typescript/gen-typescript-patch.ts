import {miscUtils}                   from '@yarnpkg/core';
import type {PortablePath}           from '@yarnpkg/fslib';
import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';
import assert                        from 'node:assert';
import type {SpawnOptions}           from 'node:child_process';
import {createHash}                  from 'node:crypto';
import semver                        from 'semver';

import {PatchGenerator}              from '../PatchGenerator';
import {spawn, logger}               from '../utils';

const IGNORED_VERSIONS = new Set([
  `3.3.3333`,
  `3.7.0-beta`,
  `3.9.0-beta`,
  `4.0.0-beta`,
  `4.3.0-beta`,
  `4.4.0-beta`,
  // Broken publish - missing files
  `4.9.0-beta`,
]);

type Slice = {
  from: string;
  to: string;
  onto: string;
  range: string;
  versions?: {
    node?: string;
    npm?: string;
  };
};
const SLICES: Array<Slice> = [
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `e39bdc3`,
    range: `>=3.2 <3.5`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `cf7b2d4`,
    range: `>=3.5 <=3.6`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  {
    from: `5d50de3`,
    to: `2f85932`,
    onto: `e39bdc3`,
    range: `>=3.7 <3.9`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  {
    from: `5d50de3`,
    to: `3af06df`,
    onto: `551f0dd`,
    range: `>=3.9 <4.0`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  {
    from: `6dbdd2f`,
    to: `6dbdd2f`,
    onto: `56865f7`,
    range: `>=4.0 <4.1`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  {
    from: `746d79b`,
    to: `746d79b`,
    onto: `69972a3`,
    range: `>=4.1 <4.2`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.2
  {
    from: `8e0e8703b9c95013aec7819e4593d099cdf7763a`,
    to: `178a67b4663d80b0fcbea542e7255b4499b51708`,
    onto: `bfc55b5762443c37ecdef08a3b5a4e057b4d1e85`,
    range: `>=4.2 <4.3`,
    versions: {
      node: `14.15.5`,
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.3
  {
    from: `530aad19e4ac19d35cb6b200168c91ce86cb0050`,
    to: `ffa54c5a104e7940b5c23666ddffbf44878f9d9f`,
    onto: `28e3e6ff2f49f1dbf06d31809ec73dbe42f1aa63`,
    range: `>=4.3 <4.4`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.4
  {
    from: `793bfe32745bf6797924354b0fd5be62cf01950c`,
    to: `20ffca2f3c48591c971e6606a55b7b1820d8a64f`,
    onto: `a10409ccaa3604790dc45f52ef0402eb49015dcf`,
    range: `>=4.4 <4.5`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.5
  {
    from: `9232978f8e54f073b5451d0bf2737d42a0fd672f`,
    to: `3a2388d39d41d000b5c5f9bcd48096b39fcedf8f`,
    onto: `55e13e9115b3cc5458d76c39da1211dc28d7b51f`,
    range: `>=4.5.2 <4.6`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.6
  {
    from: `fbec717ef33fc2db5791f2a1d5f9a315e293a50a`,
    to: `fbec717ef33fc2db5791f2a1d5f9a315e293a50a`,
    onto: `83efc9f0d646bf86a3469e00c5ef5e4f7ab7cb95`,
    range: `>=4.6.1-rc <4.7`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.7
  {
    from: `cd8d000510ed2d2910e0ebaa903a51adda546a0a`,
    to: `cd8d000510ed2d2910e0ebaa903a51adda546a0a`,
    onto: `6e62273fa1e7469b89b589667c2c233789c62176`,
    range: `>=4.7.0-beta <4.8`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.8.0-beta
  {
    from: `3287098f4785fd652112beadf3b33a960fcd19aa`,
    to: `3287098f4785fd652112beadf3b33a960fcd19aa`,
    onto: `9a09c37878a45b06994485fdb510eb4d24587dcb`,
    range: `>=4.8.0-beta <4.8.1-rc`,
    versions: {
      npm: `6.14.11`,
    },
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.8-stable
  {
    from: `623a7ac5aa49250155d39e604b09b4d015468a9c`,
    to: `30840e0c2ad8e115c518f87379b7cb55fdf77f03`,
    onto: `60b5167a2a7015759d048cdd4655d1f66a8416a2`,
    range: `>=4.8.1-rc <4.8.4`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.8
  {
    from: `d3747e92c3cd2d1f98739382c14226a725df38fd`,
    to: `5b9a74243e47db6113e857eabe5d26589fa0b64f`,
    onto: `a614119c1921ca61d549a7eee65c0b8c69c28752`,
    range: `>=4.8.4 <4.9.1-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.9-beta
  {
    from: `69c84aacfcea603c4d74721366cdcbbebd1c1681`,
    to: `18b67922d3dcc5215541a38bf6417972270bf60f`,
    onto: `549b5429d4837344e8c99657109bb6538fd2dbb5`,
    range: `>=4.9.1-beta <4.9.2-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.9-rc
  {
    from: `5613f8d8e30dfa9fb3da15e2b8432ed7e2347a12`,
    to: `d3a8a86ce4774d607c5a4a225cc5b59b1f96f42f`,
    onto: `107f832b80df2dc97748021cb00af2b6813db75b`,
    range: `>=4.9.2-rc <4.9.4`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-4.9
  {
    from: `a0859a75a408ec95222a3f0175ba0644d60396f1`,
    to: `936e68ba96e004bd32e438d64ac720c3bfe5576b`,
    onto: `e2868216f637e875a74c675845625eb15dcfe9a2`,
    range: `>=4.9.4 <5.0.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.0-beta
  {
    from: `65bff6fadce4736bb9a77213ba8016f1ac7d25e5`,
    to: `6225be2771938c6a1fce825eabe66292e4ace489`,
    onto: `dcad07ffd29854e2b93a86da0ba197f6eec21698`,
    range: `>=5.0.0-beta <5.0.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.0
  {
    from: `2c85874875fdf1f1182733b99afe47604915bfec`,
    to: `9a2c1c80b05a5fbd5bc6d2bfcbaa617793a236ab`,
    onto: `89515ce7e31d0bfaef776ac25929a78015cceb82`,
    range: `>=5.0.1-rc <5.1.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.1-beta
  {
    from: `a6ef895fb06014c416cce2f80969912ec5ea47d5`,
    to: `a6ef895fb06014c416cce2f80969912ec5ea47d5`,
    onto: `1c5cc6152322cd5b131b6e617e0947bcb068fc4a`,
    range: `>=5.1.0-beta <5.1.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.1
  {
    from: `20514ce182c598568e4a9c7ed60a4ce84740cecd`,
    to: `20514ce182c598568e4a9c7ed60a4ce84740cecd`,
    onto: `5c47c6ab567cace50ab5f331a7381b9f0edb56ca`,
    range: `>=5.1.1-rc <5.2.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.2-beta
  {
    from: `8781702c1b45bd2d5d437c0a138dd62b57b9b284`,
    to: `8781702c1b45bd2d5d437c0a138dd62b57b9b284`,
    onto: `d6e7eb6cf08a1cc8fb6d9888f74b0e694cc2a7b0`,
    range: `>=5.2.0-beta <5.2.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.2
  {
    from: `8c288a316928c9c161215fdf91ef015caa610d5b`,
    to: `8c288a316928c9c161215fdf91ef015caa610d5b`,
    onto: `6074b9d12b70757fe68ab2b4da059ea363c4df04`,
    range: `>=5.2.1-rc <5.3.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.3-beta
  {
    from: `2b564c684dc5338c59c31f4658b737912ad46336`,
    to: `2b564c684dc5338c59c31f4658b737912ad46336`,
    onto: `c5de6b57b7f09a6d17eb4a5dab91ecf8f5b25f29`,
    range: `>=5.3.0-beta <5.3.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.3
  {
    from: `9fb5c1cac14376fe615dfd48ddbe4e97c2e6ac90`,
    to: `9fb5c1cac14376fe615dfd48ddbe4e97c2e6ac90`,
    onto: `88f80c75e1a4ab6aaec605aa4ec6281b87871ff0`,
    range: `>=5.3.1-rc <5.4.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.4-beta
  {
    from: `9420c380b6f1f072ff66372cbf776fafd6eeed1c`,
    to: `9420c380b6f1f072ff66372cbf776fafd6eeed1c`,
    onto: `e80675868dff622d0870939e7c9930c68904e7e7`,
    range: `>=5.4.0-beta <5.4.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.4-rc
  {
    from: `786e26825dad9dcc0eff79610bffd8bb121e7e8a`,
    to: `786e26825dad9dcc0eff79610bffd8bb121e7e8a`,
    onto: `db6b2a980280a9c87799b9c1edd6d71e92bb255b`,
    range: `>=5.4.1-rc <5.5.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.5-beta
  {
    from: `f90eb7508e66a3d5066b1d8a06606c6c23f3df43`,
    to: `43d2cbd6ac423e35a5a095a509fc90c03f0c22ba`,
    onto: `b574864abc989d0f8b15367baea1058819e126ba`,
    range: `>=5.5.0-beta <5.5.2`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.5
  {
    from: `5b321aa5835f9f4dba6d55553fd559985d44b1a9`,
    to: `c41328460d8dba2fac56c220803c68ca961d7cd5`,
    onto: `ce2e60e4ea15a65992e54a9e8877d16be9d42abb`,
    range: `>=5.5.2 <5.6.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.6-beta
  {
    from: `b774b54693034b8aeae7f9a7b24d25fcacdbc8a5`,
    to: `b774b54693034b8aeae7f9a7b24d25fcacdbc8a5`,
    onto: `b4732bdd6199ec353ec0873f334515f391d80d3b`,
    range: `>=5.6.0-beta <5.6.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.6-rc
  {
    from: `0102e47303cb33503219740015f711e2fe7d89ab`,
    to: `0102e47303cb33503219740015f711e2fe7d89ab`,
    onto: `6212132b835145b1a8fd49982680ac668caf3ddc`,
    range: `>=5.6.1-rc <5.7.0-beta`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.7-beta
  {
    from: `18776a771f795ecc2535ee56705ea9fdb786a569`,
    to: `519971751e31f38542a608abf21ba3d61c5c3f93`,
    onto: `69fb689edbbce517a4615be9d356c6c812639849`,
    range: `>=5.7.0-beta <5.7.1-rc`,
  },
  // https://github.com/yarnpkg/TypeScript/tree/merceyz/pnp-5.7-rc
  {
    from: `99f3e130bbe02473680bfa040d131c1f7f08fcc0`,
    to: `99f3e130bbe02473680bfa040d131c1f7f08fcc0`,
    onto: `c1216dea1a504da7b89b5221b925abcd1702d7e4`,
    range: `>=5.7.1-rc`,
  },
];

function logSpawn(binary: string, args: Array<string>, opts?: SpawnOptions) {
  const child = spawn(binary, args, opts);
  logger.log(`$ ${child.cmd}`);
  return child;
}

type NpmRunner = (binary: `npm` | `npx`, args: Array<string>) => ReturnType<typeof spawn>;
type NpmRunnerInitializer = (versions: {node?: string, npm?: string}, opts: SpawnOptions) => Promise<NpmRunner>;
type NodeVersioningTool = {
  name: string;
  detect: () => Promise<boolean>;
  init: NpmRunnerInitializer;
};
const tools: Array<NodeVersioningTool> = [
  {
    name: `Volta`,
    detect: async () => {
      try {
        return await logSpawn(`volta`, [`--version`]).exit === 0;
      } catch {
        return false;
      }
    },
    init: async ({node, npm}, opts) => {
      await logSpawn(`volta`, [`pin`, `node@${node}`, `npm@${npm}`], opts).success;
      return (binary, args) => logSpawn(`volta`, [`run`, binary, ...args], opts);
    },
  },
  {
    name: `mise-en-place`,
    detect: async () => {
      try {
        return await logSpawn(`mise`, [`version`]).exit === 0;
      } catch {
        return false;
      }
    },
    init: async ({node, npm}, opts) => {
      return (binary, args) => (
        logSpawn(`mise`, [`exec`, `node@${node}`, `npm@${npm}`, `--`, binary, ...args], opts)
      );
    },
  },
  {
    name: `Corepack`,
    detect: async () => {
      logger.warn(`⚠ Warning: No node versioning tool detected`);
      logger.warn(`⚠ Using current node version (${process.version}) for builds`);
      logger.warn(`⚠ This may lead to incorrect patches`);

      return true;
    },
    init: async ({npm}, opts) => {
      return (binary, args) => (
        logSpawn(`corepack`, [`${binary}@${npm}`, ...args], opts)
      );
    },
  },
];

class Repo {
  private spawnOpts: SpawnOptions;
  public constructor(public readonly dir: PortablePath) {
    this.spawnOpts = {cwd: npath.fromPortablePath(this.dir)};
  }

  private git(...args: Array<string>) {
    return logSpawn(`git`, args, this.spawnOpts);
  }

  private async resolveVersions(sliceVersions: {node?: string, npm?: string} = {}): Promise<{node: string, npm: string}> {
    const path = ppath.join(this.dir, Filename.manifest);
    const {volta: manifestVersions = {}} = JSON.parse(await xfs.readFilePromise(path, `utf8`));

    assert(!(manifestVersions.node && sliceVersions.node), `node version is already set by repo`);
    assert(!(manifestVersions.npm && sliceVersions.npm), `npm version is already set by repo`);

    const versions = {
      ...manifestVersions,
      ...sliceVersions,
    };
    assert(versions.node, `node versions set by neither repo nor slice`);
    assert(versions.npm, `npm versions set by neither repo nor slice`);

    return versions;
  }
  private getRunner: NpmRunnerInitializer = async (...args) => {
    this.getRunner = await this.chooseRunner();
    return this.getRunner(...args);
  };
  private async chooseRunner(): Promise<NpmRunnerInitializer> {
    return await logger.section(`Choose node versioning tool`, async () => {
      for (const tool of tools) {
        if (await tool.detect()) {
          logger.log(`> Using ${tool.name} to run npm`);
          return tool.init;
        }
      }

      throw new Error(`No node versioning tool found`);
    });
  }

  private ready = false;
  public async setup() {
    if (this.ready) return;

    await logger.section(`Setup yarnpkg/TypeScript repository`, async () => {
      if (await xfs.existsPromise(this.dir)) {
        await this.git(`fetch`, `origin`).success;
        await this.git(`cherry-pick`, `--abort`).close;
      } else {
        await logSpawn(`git`, [
          `clone`,
          `--filter=tree:0`,
          ...(process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES?.split(npath.delimiter) ?? [])
            .flatMap(dir => [`--reference`, npath.dirname(dir)]),
          `--dissociate`,
          `--no-checkout`,
          `https://github.com/yarnpkg/TypeScript`,
          npath.fromPortablePath(this.dir),
        ]).success;

        await this.git(`config`, `user.email`, `you@example.com`).success;
        await this.git(`config`, `user.name`, `Your Name`).success;
      }
    });

    this.getRunner = await this.chooseRunner();

    this.ready = true;
  }

  public async build({from, to, onto, versions}: Slice, patch: boolean) {
    await this.git(`switch`, `-df`, onto).success;
    await this.git(`reset`, `--hard`).success;
    await this.git(`clean`, `-dfx`).success;

    if (patch) {
      if (await spawn(`git`, [`merge-base`, `--is-ancestor`, onto, to], this.spawnOpts).exit === 0) {
        await this.git(`merge`, `--no-edit`, to).success;
      } else {
        await this.git(`cherry-pick`, `${from}^..${to}`).success;
      }
    }

    const run = await this.getRunner(await this.resolveVersions(versions), this.spawnOpts);

    if (await xfs.existsPromise(ppath.join(this.dir, `package-lock.json`))) {
      await run(`npm`, [`ci`, `--ignore-scripts`]).success;
    } else {
      const buffer = await this.git(`show`, onto, `-s`, `--format=%ci`).output;
      await run(`npm`, [`install`, `--ignore-scripts`, `--before`, buffer.toString().trim()]).success;
    }

    const command = (await xfs.existsPromise(ppath.join(this.dir, `node_modules`, `.bin`, `hereby`)))
      ? `hereby`
      : `gulp`;

    await run(`npx`, [command, `local`, `LKG`]).success;

    // It seems that in some circumstances the build can produce incorrect artifacts. When
    // that happens, the final binary is very small. We try to detect that.
    const stat = await xfs.statPromise(ppath.join(this.dir, `lib/typescript.js`));
    if (stat.size < 100_000) {
      throw new Error(`Something is wrong; typescript.js got generated with a stupid size`);
    }
  }
}

class TypeScriptPatchGenerator extends PatchGenerator<Slice & {id: string}> {
  private repo = new Repo(ppath.join(this.tmp, `repo`));
  private $versions: Promise<Array<string>>;
  private ranges = new Map<string, semver.Range>();

  public constructor() {
    super(`typescript`, SLICES.map(slice => ({
      ...slice,
      id: createHash(`md5`).update(JSON.stringify({from: slice.from, to: slice.to, onto: slice.onto})).digest(`hex`),
    })));
    this.$versions = this.fetchVersions();
  }

  protected override async build(slice: Slice, path: PortablePath): Promise<void> {
    const base = ppath.join(path, `base`);
    const patched = ppath.join(path, `patched`);

    await this.repo.setup();

    await logger.section(`Build patched version`, async () => {
      await Promise.all([
        this.repo.build(slice, true),
        xfs.mkdirpPromise(patched),
      ]);
      await xfs.movePromise(ppath.join(this.repo.dir, `lib`), ppath.join(patched, `lib`));
    });

    await logger.section(`Build base version`, async () => {
      await Promise.all([
        this.repo.build(slice, false),
        xfs.mkdirpPromise(base),
      ]);
      await xfs.movePromise(ppath.join(this.repo.dir, `lib`), ppath.join(base, `lib`));
    });
  }

  private async fetchVersions() {
    // eslint-disable-next-line no-restricted-globals
    const response = await fetch(`https://registry.yarnpkg.com/typescript`);
    const data = await response.json() as {versions: Record<string, unknown>};
    return Object.keys(data.versions)
      .filter(version => {
        const pre = semver.prerelease(version);
        return (!pre || pre[0] === `beta` || pre[0] === `rc`);
      })
      .filter(version => !IGNORED_VERSIONS.has(version));
  }
  protected override async getValidateVersions(slice: Slice): Promise<Array<string>> {
    const versions = await this.$versions;
    // eslint-disable-next-line no-restricted-properties
    const range = miscUtils.getFactoryWithDefault(this.ranges, slice.range, () => new semver.Range(slice.range, {includePrerelease: true}));
    return versions.filter(range.test.bind(range));
  }
}

async function main() {
  const generator = new TypeScriptPatchGenerator();
  await generator.generateBundle(
    process.argv.slice(2),
    ppath.resolve(
      npath.toPortablePath(__dirname),
      `../../sources/patches/typescript.patch.ts`,
    ),
  );
}

main().catch(err => {
  console.error();
  console.error(err.stack);
  process.exitCode = 1;
});
