import {WorkspaceRequiredError}                                                       from '@berry/cli';
import {Configuration, Ident,MessageName, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {miscUtils, structUtils}                                                       from '@berry/core';
import {npmConfigUtils, npmHttpUtils}                                                 from '@berry/plugin-npm';
import {packUtils}                                                                    from '@berry/plugin-pack';
import {UsageError}                                                                   from 'clipanion';
import {createHash}                                                                   from 'crypto';
import ssri                                                                           from 'ssri';
import {Writable}                                                                     from 'stream';
import * as yup                                                                       from 'yup';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm publish [--tag TAG] [-i,--interactive]`)
  .categorize(`Npm-related commands`)
  .describe(`send the workspace package to the npm registry`)

  .validate(yup.object().shape({
    tag: yup.string().default(`latest`),
  }))

  .detail(`
    This command will pack the active workspace into a fresh archive and upload it to the npm registry.

    The package will by default be attached to the \`latest\` tag on the registry, but this behavior can be overriden by using the \`--tag\` option.
  `)

  .example(
    `Publish the active workspace`,
    `yarn npm publish`,
  )

  .action(async ({cwd, stdout, tag}: {cwd: string, stdout: Writable, tag: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    if (workspace.manifest.private)
      throw new UsageError(`Private workspaces cannot be published`);
    if (workspace.manifest.name === null || workspace.manifest.version === null)
      throw new UsageError(`Workspaces must have valid names and versions to be published on an external registry`);

    const ident = workspace.manifest.name;
    const version = workspace.manifest.version;

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const pack = await packUtils.genPackStream(workspace);
      const buffer = await miscUtils.bufferStream(pack);

      const body = makePublishBody(ident, version, buffer, {tag});

      try {
        await npmHttpUtils.put(`/${structUtils.stringifyIdent(ident)}`, body, {
          configuration,
          ident,
          json: true,
        });
      } catch (error) {
        if (error.name === `HTTPError`) {
          const message = error.body && error.body.error
            ? error.body.error
            : `The remote server answered with HTTP ${error.statusCode} ${error.statusMessage}`;

          report.reportError(MessageName.NETWORK_ERROR, message);
        } else {
          throw error;
        }
      }
    });

    return report.exitCode();
  });

function makePublishBody(ident: Ident, version: string, buffer: Buffer, {tag}: {tag: string}) {
  const name = structUtils.stringifyIdent(ident);

  const shasum = createHash('sha1').update(buffer).digest('hex');
  const integrity = ssri.fromData(buffer).toString();

  return {
    _id: name,
    _attachments: {
      [`${name}-${version}.tgz`]: {
        content_type: `application/octet-stream`,
        data: buffer.toString(`base64`),
        length: buffer.length,
      },
    },

    name,

    [`dist-tags`]: {
      [tag]: version,
    },

    versions: {
      [version]: {
        _id: `${name}@${version}`,

        name: name,
        version: version,

        dist: {
          shasum,
          integrity,

          // the npm registry requires a tarball path, but it seems useless 🤷
          tarball: `https://example.org/yarn/was/here.tgz`,
        },
      },
    },
  };
}
