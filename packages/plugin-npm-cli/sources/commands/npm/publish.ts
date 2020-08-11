import {BaseCommand, WorkspaceRequiredError}                                             from '@yarnpkg/cli';
import {Configuration, MessageName, Project, ReportError, StreamReport, Manifest, Ident} from '@yarnpkg/core';
import {miscUtils, structUtils}                                                          from '@yarnpkg/core';
import {PortablePath, xfs, ppath, npath}                                                 from '@yarnpkg/fslib';
import {npmConfigUtils, npmHttpUtils}                                                    from '@yarnpkg/plugin-npm';
import {packUtils}                                                                       from '@yarnpkg/plugin-pack';
import {Command, Usage, UsageError}                                                      from 'clipanion';
import {createHash}                                                                      from 'crypto';
import ssri                                                                              from 'ssri';

// eslint-disable-next-line arca/no-default-export
export default class NpmPublishCommand extends BaseCommand {
  @Command.String({required: false})
  tarballPath?: string;

  @Command.String(`--access`)
  access?: string;

  @Command.String(`--tag`)
  tag: string = `latest`;

  @Command.Boolean(`--tolerate-republish`)
  tolerateRepublish: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `publish a package to the npm registry`,
    details: `
      This command will upload a package to the npm registry.
      If no tarball path is given, it will pack the active workspace into a fresh archive and upload it to the npm registry.

      The package will by default be attached to the \`latest\` tag on the registry, but this behavior can be overriden by using the \`--tag\` option.

      Note that for legacy reasons scoped packages are by default published with an access set to \`restricted\` (aka "private packages"). This requires you to register for a paid npm plan. In case you simply wish to publish a public scoped package to the registry (for free), just add the \`--access public\` flag. This behavior can be enabled by default through the \`npmPublishAccess\` settings.
    `,
    examples: [[
      `Publish the active workspace`,
      `yarn npm publish`,
    ],
    [
      `Publish a tarball`,
      `yarn npm publish ./package.tgz`,
    ]],
  });

  @Command.Path(`npm`, `publish`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const tgzPath: undefined | PortablePath = this.tarballPath == undefined ? undefined :
      npath.isAbsolute( this.tarballPath) ? this.tarballPath as PortablePath : ppath.join(this.context.cwd, this.tarballPath as PortablePath);
    let manifest: Manifest;
    if (tgzPath !== undefined) { //if the tarball path was explicitly given, we must use it and ignore the workspace.
      manifest = await packUtils.getManifestFromTarball(tgzPath);
    } else {
      if (!workspace)
        throw new WorkspaceRequiredError(project.cwd, this.context.cwd);
      manifest = workspace.manifest;
    }
    if (manifest.private)
      throw new UsageError(`Private workspaces cannot be published`);
    if (manifest.name === null || manifest.version === null)
      throw new UsageError(`Workspaces must have valid names and versions to be published on an external registry`);
    if (this.tarballPath === undefined) //No need to restore when we publish a tarball.
      await project.restoreInstallState();
    // We store it so that TS knows that it's non-null
    const ident = manifest.name;
    const version = manifest.version;

    const registry = npmConfigUtils.getPublishRegistry(manifest, {configuration});

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      // Not an error if --tolerate-republish is set
      if (this.tolerateRepublish) {
        try {
          const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(ident), {
            configuration,
            registry,
            ident,
            json: true,
          });

          if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
            throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

          if (Object.prototype.hasOwnProperty.call(registryData.versions, version)) {
            report.reportWarning(MessageName.UNNAMED, `Registry already knows about version ${version}; skipping.`);
            return;
          }
        } catch (error) {
          if (error.name !== `HTTPError`) {
            throw error;
          } else if (error.response.statusCode !== 404) {
            throw new ReportError(MessageName.NETWORK_ERROR, `The remote server answered with HTTP ${error.response.statusCode} ${error.response.statusMessage}`);
          }
        }
      }

      if (tgzPath === undefined) { //workspace was previously checked as defined if tgzPath is undefined.
        await packUtils.prepareForPack(workspace!, {report}, async () => {
          const files = await packUtils.genPackList(workspace!);

          for (const file of files)
            report.reportInfo(null, file);

          const pack = await packUtils.genPackStream(workspace!, files);
          const buffer = await miscUtils.bufferStream(pack);
          const tarballManifest = await packUtils.getManifestFromTgzBuffer(buffer);//genPackStream may have modified the manifest through plugins, so we grab the modified manifest from the tarball.
          await this.publishBuffer(tarballManifest, buffer, ident, registry, configuration, report);
        });
      } else {
        const buffer = await xfs.readFilePromise(tgzPath);
        await this.publishBuffer(manifest, buffer, ident, registry, configuration, report);
      }


      if (!report.hasErrors()) {
        report.reportInfo(MessageName.UNNAMED, `Package archive published`);
      }
    });

    return report.exitCode();
  }

  async publishBuffer(manifest: Manifest, buffer: Buffer, ident: Ident, registry: string, configuration: Configuration, report: StreamReport) {
    const body = await makePublishBody(manifest, configuration, buffer, {
      access: this.access,
      tag: this.tag,
      registry,
    });

    try {
      await npmHttpUtils.put(npmHttpUtils.getIdentUrl(ident), body, {
        configuration,
        registry,
        ident,
        json: true,
      });
    } catch (error) {
      if (error.name !== `HTTPError`) {
        throw error;
      } else {
        const message = error.response.body && error.response.body.error
          ? error.response.body.error
          : `The remote server answered with HTTP ${error.response.statusCode} ${error.response.statusMessage}`;

        report.reportError(MessageName.NETWORK_ERROR, message);
      }
    }
  }
}

async function makePublishBody(manifest: Manifest, configuration: Configuration, buffer: Buffer, {access, tag, registry}: { access: string | undefined, tag: string, registry: string }) {
  const ident = manifest.name!;
  const version = manifest.version!;

  const name = structUtils.stringifyIdent(ident);

  const shasum = createHash(`sha1`).update(buffer).digest(`hex`);
  const integrity = ssri.fromData(buffer).toString();

  if (typeof access === `undefined`) {
    if (manifest.publishConfig && typeof manifest.publishConfig.access === `string`) {
      access = manifest.publishConfig.access;
    } else if (configuration.get(`npmPublishAccess`) !== null) {
      access = configuration.get(`npmPublishAccess`);
    } else if (ident.scope) {
      access = `restricted`;
    } else {
      access = `public`;
    }
  }

  const raw = JSON.parse(JSON.stringify(manifest.raw));

  // This matches Lerna's logic:
  // https://github.com/evocateur/libnpmpublish/blob/latest/publish.js#L142
  // While the npm registry ignores the provided tarball URL, it's used by
  // other registries such as verdaccio.
  const tarballName = `${name}-${version}.tgz`;
  const tarballURL = new URL(`${name}/-/${tarballName}`, registry);

  return {
    _id: name,
    _attachments: {
      [tarballName]: {
        [`content_type`]: `application/octet-stream`,
        data: buffer.toString(`base64`),
        length: buffer.length,
      },
    },

    name,
    access,

    [`dist-tags`]: {
      [tag]: version,
    },

    versions: {
      [version]: {
        ...raw,

        _id: `${name}@${version}`,

        name,
        version,

        dist: {
          shasum,
          integrity,

          // the npm registry requires a tarball path, but it seems useless 🤷
          tarball: tarballURL.toString(),
        },
      },
    },
  };
}
