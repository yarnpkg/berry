import {BaseCommand, WorkspaceRequiredError}                                                                                                     from '@yarnpkg/cli';
import {Configuration, Descriptor, Project, ReportError, MessageName, Workspace, formatUtils, structUtils, treeUtils, LightReport, StreamReport} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils}                                                                                                            from '@yarnpkg/plugin-npm';
import {Command, Usage}                                                                                                                          from 'clipanion';

import * as npmAuditTypes                                                                                                                        from '../../npmAuditTypes';
import * as npmAuditUtils                                                                                                                        from '../../npmAuditUtils';

// eslint-disable-next-line arca/no-default-export
export default class AuditCommand extends BaseCommand {
  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.String(`--environment`)
  environment: npmAuditTypes.Environment = npmAuditTypes.Environment.All;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.String(`--severity`)
  severity: npmAuditTypes.Severity = npmAuditTypes.Severity.Info;

  static usage: Usage = Command.Usage({
    description: `perform a vulnerability audit against the installed packages`,
    details: `
      Checks for known security issues with the installed packages. The output is a list of known issues.

      You must be online to perform the audit.

      If \`-A,--all\` is set, the report will include dependencies from the whole project.

      Applying the \`--severity\` flag will limit the audit table to vulnerabilities of the corresponding severity and above.

      For scripting purposes, yarn audit also supports the --json flag, which will output the details for the issues in JSON-lines format (one JSON object per line) instead of plain text.
    `,
    examples: [[
      `Checks for known security issues with the installed packages. The output is a list of known issues.`,
      `yarn npm audit`,
    ], [
      `Audit dependencies in all workspaces`,
      `yarn npm audit --all`,
    ], [
      `Limit auditing to \`dependencies\` (excludes \`devDependencies\`)`,
      `yarn npm audit --environment production`,
    ], [
      `Show audit report as valid JSON`,
      `yarn npm audit --json`,
    ], [
      `Output moderate (or more severe) vulnerabilities`,
      `yarn npm audit --severity moderate`,
    ]],
  });

  @Command.Path(`npm`, `audit`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const body = {
      requires: npmAuditUtils.getRequires(project, workspace, {all: this.all}),
      dependencies: npmAuditUtils.getDependencies(project, workspace, {all: this.all}),
    };

    const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {
      configuration,
    });

    let result!: npmAuditTypes.AuditResponse;
    const httpReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      try {
        result = ((await npmHttpUtils.post(`/-/npm/v1/security/audits/quick`, body, {
          authType: npmHttpUtils.AuthType.NO_AUTH,
          configuration,
          jsonResponse: true,
          registry,
        })) as unknown) as npmAuditTypes.AuditResponse;
      } catch (err) {
        if (err.name !== `HTTPError`) {
          throw err;
        } else {
          throw new ReportError(MessageName.EXCEPTION, err.toString());
        }
      }
    });

    if (httpReport.hasErrors())
      return httpReport.exitCode();

    const hasError = npmAuditUtils.isError(result.metadata.vulnerabilities, this.severity);
    if (!this.json && hasError) {
      treeUtils.emitTree(npmAuditUtils.getReportTree(result), {
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        separators: 2,
      });
      return 1;
    }

    const outReport = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      report.reportJson(result);

      if (!hasError) {
        report.reportInfo(MessageName.EXCEPTION, `No audit suggestions`);
      }
    });

    return outReport.exitCode();
  }
}
