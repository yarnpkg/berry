import {BaseCommand}                                           from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, formatUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                          from '@yarnpkg/plugin-npm';
import {Command, Option, Usage, UsageError}                    from 'clipanion';
import * as t                                                  from 'typanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmStageRejectCommand extends BaseCommand {
  static paths = [
    [`npm`, `stage`, `reject`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `reject a staged package version`,
    details: `
      This command will reject a staged package version, permanently removing it from the registry staging area. This operation requires 2FA and will prompt for an OTP token if one is not provided via the \`--otp\` flag.
    `,
    examples: [[
      `Reject a staged package`,
      `yarn npm stage reject 1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f`,
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

      report.reportInfo(MessageName.UNNAMED, `Rejecting staged package ${formatUtils.pretty(configuration, prettyStageId, formatUtils.Type.CODE)}...`);
      report.reportSeparator();

      await npmHttpUtils.del(`/-/stage/${this.stageId}`, {
        configuration,
        registry,
        otp: this.otp,
        authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
      });

      report.reportInfo(MessageName.UNNAMED, `Staged package ${formatUtils.pretty(configuration, prettyStageId, formatUtils.Type.CODE)} has been rejected.`);
    });

    return report.exitCode();
  }
}
