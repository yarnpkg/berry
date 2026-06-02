import {BaseCommand}                                           from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, formatUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                          from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                from 'clipanion';
import * as t                                                  from 'typanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmStageApproveCommand extends BaseCommand {
  static paths = [
    [`npm`, `stage`, `approve`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `approve a staged package version for publishing`,
    details: `
      This command will approve a staged package version, publishing it to the npm registry. This operation requires 2FA and will prompt for an OTP token if one is not provided via the \`--otp\` flag.
    `,
    examples: [[
      `Approve a staged package`,
      `yarn npm stage approve 1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f`,
    ]],
  });

  stageId = Option.String({
    validator: t.cascade(t.isString(), [
      t.matchesRegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    ]),
  });

  otp = Option.String(`--otp`, {
    description: `The OTP token to use with the command`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const registry = npmConfigUtils.getDefaultRegistry({configuration, type: npmConfigUtils.RegistryType.PUBLISH_REGISTRY});

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const prettyStageId = formatUtils.pretty(configuration, this.stageId, formatUtils.Type.CODE);

      report.reportInfo(MessageName.UNNAMED, `Approving staged package ${formatUtils.pretty(configuration, prettyStageId, formatUtils.Type.CODE)}...`);
      report.reportSeparator();

      await npmHttpUtils.post(`/-/stage/${this.stageId}/approve`, null, {
        configuration,
        registry,
        otp: this.otp,
        jsonResponse: true,
        authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
      });

      report.reportInfo(MessageName.UNNAMED, `Staged package ${formatUtils.pretty(configuration, prettyStageId, formatUtils.Type.CODE)} approved and published successfully.`);
    });

    return report.exitCode();
  }
}
