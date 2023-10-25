import {BaseCommand}                                              from '@yarnpkg/cli';
import {Configuration, Manifest, miscUtils, Project, YarnVersion} from '@yarnpkg/core';
import {execUtils, scriptUtils, structUtils}                      from '@yarnpkg/core';
import {xfs, ppath, Filename}                                     from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class InitCommand extends BaseCommand {
  static paths = [
    [`init`],
  ];

  static usage: Usage = Command.Usage({
    description: `create a new package`,
    details: `
      This command will setup a new package in your local directory.

      If the \`-p,--private\` or \`-w,--workspace\` options are set, the package will be private by default.

      If the \`-w,--workspace\` option is set, the package will be configured to accept a set of workspaces in the \`packages/\` directory.

      If the \`-i,--install\` option is given a value, Yarn will first download it using \`yarn set version\` and only then forward the init call to the newly downloaded bundle. Without arguments, the downloaded bundle will be \`latest\`.

      The initial settings of the manifest can be changed by using the \`initScope\` and \`initFields\` configuration values. Additionally, Yarn will generate an EditorConfig file whose rules can be altered via \`initEditorConfig\`, and will initialize a Git repository in the current directory.
    `,
    examples: [[
      `Create a new package in the local directory`,
      `yarn init`,
    ], [
      `Create a new private package in the local directory`,
      `yarn init -p`,
    ], [
      `Create a new package and store the Yarn release inside`,
      `yarn init -i=latest`,
    ], [
      `Create a new private package and defines it as a workspace root`,
      `yarn init -w`,
    ]],
  });

  private = Option.Boolean(`-p,--private`, false, {
    description: `Initialize a private package`,
  });

  workspace = Option.Boolean(`-w,--workspace`, false, {
    description: `Initialize a workspace root with a \`packages/\` directory`,
  });

  install = Option.String(`-i,--install`, false, {
    tolerateBoolean: true,
    description: `Initialize a package with a specific bundle that will be locked in the project`,
  });

  name = Option.String(`-n,--name`, {
    description: `Initialize a package with the given name`,
  });

  // Options that only mattered on v1
  usev2 = Option.Boolean(`-2`, false, {hidden: true});
  yes = Option.Boolean(`-y,--yes`, {hidden: true});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const install = typeof this.install === `string`
      ? this.install
      : this.usev2 || this.install === true
        ? `latest`
        : null;

    if (install !== null) {
      return await this.executeProxy(configuration, install);
    } else {
      return await this.executeRegular(configuration);
    }
  }

  async executeProxy(configuration: Configuration, version: string) {
    if (configuration.projectCwd !== null && configuration.projectCwd !== this.context.cwd)
      throw new UsageError(`Cannot use the --install flag from within a project subdirectory`);

    if (!xfs.existsSync(this.context.cwd))
      await xfs.mkdirPromise(this.context.cwd, {recursive: true});

    const lockfilePath = ppath.join(this.context.cwd, Filename.lockfile);
    if (!xfs.existsSync(lockfilePath))
      await xfs.writeFilePromise(lockfilePath, ``);

    const versionExitCode = await this.cli.run([`set`, `version`, version], {quiet: true});
    if (versionExitCode !== 0)
      return versionExitCode;

    const args: Array<string> = [];
    if (this.private)
      args.push(`-p`);
    if (this.workspace)
      args.push(`-w`);
    if (this.name)
      args.push(`-n=${this.name}`);
    if (this.yes)
      args.push(`-y`);

    return await xfs.mktempPromise(async binFolder => {
      const {code} = await execUtils.pipevp(`yarn`, [`init`, ...args], {
        cwd: this.context.cwd,
        stdin: this.context.stdin,
        stdout: this.context.stdout,
        stderr: this.context.stderr,
        env: await scriptUtils.makeScriptEnv({binFolder}),
      });

      return code;
    });
  }

  async executeRegular(configuration: Configuration) {
    let existingProject: Project | null = null;
    try {
      existingProject = (await Project.find(configuration, this.context.cwd)).project;
    } catch {
      existingProject = null;
    }

    if (!xfs.existsSync(this.context.cwd))
      await xfs.mkdirPromise(this.context.cwd, {recursive: true});

    const original = await Manifest.tryFind(this.context.cwd);
    const manifest = original ?? new Manifest();

    const fields = Object.fromEntries(configuration.get(`initFields`).entries());
    manifest.load(fields);

    manifest.name = manifest.name
      ?? structUtils.makeIdent(configuration.get(`initScope`), this.name ?? ppath.basename(this.context.cwd));

    manifest.packageManager = YarnVersion && miscUtils.isTaggedYarnVersion(YarnVersion)
      ? `yarn@${YarnVersion}`
      : null;

    if ((!original && this.workspace) || this.private)
      manifest.private = true;

    if (this.workspace && manifest.workspaceDefinitions.length === 0) {
      await xfs.mkdirPromise(ppath.join(this.context.cwd, `packages`), {recursive: true});
      manifest.workspaceDefinitions = [{
        pattern: `packages/*`,
      }];
    }

    const serialized: any = {};
    manifest.exportTo(serialized);

    const manifestPath = ppath.join(this.context.cwd, Manifest.fileName);
    await xfs.changeFilePromise(manifestPath, `${JSON.stringify(serialized, null, 2)}\n`, {
      automaticNewlines: true,
    });

    const changedPaths = [
      manifestPath,
    ];

    const readmePath = ppath.join(this.context.cwd, `README.md`);
    if (!xfs.existsSync(readmePath)) {
      await xfs.writeFilePromise(readmePath, `# ${structUtils.stringifyIdent(manifest.name)}\n`);
      changedPaths.push(readmePath);
    }

    if (!existingProject || existingProject.cwd === this.context.cwd) {
      const lockfilePath = ppath.join(this.context.cwd, Filename.lockfile);
      if (!xfs.existsSync(lockfilePath)) {
        await xfs.writeFilePromise(lockfilePath, ``);
        changedPaths.push(lockfilePath);
      }

      const gitignoreLines = [
        `.yarn/*`,
        `!.yarn/patches`,
        `!.yarn/plugins`,
        `!.yarn/releases`,
        `!.yarn/sdks`,
        `!.yarn/versions`,
        ``,
        `# Swap the comments on the following lines if you wish to use zero-installs`,
        `# In that case, don't forget to run \`yarn config set enableGlobalCache false\`!`,
        `# Documentation here: https://yarnpkg.com/features/caching#zero-installs`,
        ``,
        `#!.yarn/cache`,
        `.pnp.*`,
      ];

      const gitignoreBody = gitignoreLines.map(line => {
        return `${line}\n`;
      }).join(``);

      const gitignorePath = ppath.join(this.context.cwd, `.gitignore`);
      if (!xfs.existsSync(gitignorePath)) {
        await xfs.writeFilePromise(gitignorePath, gitignoreBody);
        changedPaths.push(gitignorePath);
      }

      const gitattributesLines = [
        `/.yarn/**            linguist-vendored`,
        `/.yarn/releases/*    binary`,
        `/.yarn/plugins/**/*  binary`,
        `/.pnp.*              binary linguist-generated`,
      ];

      const gitattributesBody = gitattributesLines.map(line => {
        return `${line}\n`;
      }).join(``);

      const gitattributesPath = ppath.join(this.context.cwd, `.gitattributes`);
      if (!xfs.existsSync(gitattributesPath)) {
        await xfs.writeFilePromise(gitattributesPath, gitattributesBody);
        changedPaths.push(gitattributesPath);
      }

      const editorConfigProperties = {
        [`*`]: {
          endOfLine: `lf`,
          insertFinalNewline: true,
        },
        [`*.{js,json,yml}`]: {
          charset: `utf-8`,
          indentStyle: `space`,
          indentSize: 2,
        },
      };

      miscUtils.mergeIntoTarget(editorConfigProperties, configuration.get(`initEditorConfig`));

      let editorConfigBody = `root = true\n`;
      for (const [selector, props] of Object.entries(editorConfigProperties)) {
        editorConfigBody += `\n[${selector}]\n`;
        for (const [propName, propValue] of Object.entries(props)) {
          const snakeCaseName = propName.replace(/[A-Z]/g, $0 => `_${$0.toLowerCase()}`);
          editorConfigBody += `${snakeCaseName} = ${propValue}\n`;
        }
      }

      const editorConfigPath = ppath.join(this.context.cwd, `.editorconfig`);
      if (!xfs.existsSync(editorConfigPath)) {
        await xfs.writeFilePromise(editorConfigPath, editorConfigBody);
        changedPaths.push(editorConfigPath);
      }

      await this.cli.run([`install`], {
        quiet: true,
      });

      if (!xfs.existsSync(ppath.join(this.context.cwd, `.git`))) {
        await execUtils.execvp(`git`, [`init`], {
          cwd: this.context.cwd,
        });

        await execUtils.execvp(`git`, [`add`, `--`, ...changedPaths], {
          cwd: this.context.cwd,
        });

        await execUtils.execvp(`git`, [`commit`, `--allow-empty`, `-m`, `First commit`], {
          cwd: this.context.cwd,
        });
      }
    }
  }
}
