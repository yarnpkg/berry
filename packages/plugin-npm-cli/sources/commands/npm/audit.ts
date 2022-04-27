import {BaseCommand, WorkspaceRequiredError}                                       from '@yarnpkg/cli';
import {Configuration, Project, MessageName, treeUtils, LightReport, StreamReport} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils}                                              from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                                    from 'clipanion';
import micromatch                                                                  from 'micromatch';
import * as t                                                                      from 'typanion';

import * as npmAuditTypes                                                          from '../../npmAuditTypes';
import * as npmAuditUtils                                                          from '../../npmAuditUtils';

// eslint-disable-next-line arca/no-default-export
export default class AuditCommand extends BaseCommand {
  static paths = [
    [`npm`, `audit`],
  ];

  static usage: Usage = Command.Usage({
    description: `perform a vulnerability audit against the installed packages`,
    details: `
      This command checks for known security reports on the packages you use. The reports are by default extracted from the npm registry, and may or may not be relevant to your actual program (not all vulnerabilities affect all code paths).

      For consistency with our other commands the default is to only check the direct dependencies for the active workspace. To extend this search to all workspaces, use \`-A,--all\`. To extend this search to both direct and transitive dependencies, use \`-R,--recursive\`.

      Applying the \`--severity\` flag will limit the audit table to vulnerabilities of the corresponding severity and above. Valid values are ${npmAuditUtils.allSeverities.map(value => `\`${value}\``).join(`, `)}.

      If the \`--json\` flag is set, Yarn will print the output exactly as received from the registry. Regardless of this flag, the process will exit with a non-zero exit code if a report is found for the selected packages.

      If certain packages produce false positives for a particular environment, the \`--exclude\` flag can be used to exclude any number of packages from the audit. This can also be set in the configuration file with the \`npmAuditExcludePackages\` option.

      If particular advisories are needed to be ignored, the \`--ignore\` flag can be used with Advisory ID's to ignore any number of advisories in the audit report. This can also be set in the configuration file with the \`npmAuditIgnoreAdvisories\` option.

      To understand the dependency tree requiring vulnerable packages, check the raw report with the \`--json\` flag or use \`yarn why <package>\` to get more information as to who depends on them.
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
      `Audit all direct and transitive dependencies`,
      `yarn npm audit --recursive`,
    ], [
      `Output moderate (or more severe) vulnerabilities`,
      `yarn npm audit --severity moderate`,
    ], [
      `Exclude certain packages`,
      `yarn npm audit --exclude package1 --exclude package2`,
    ], [
      `Ignore specific advisories`,
      `yarn npm audit --ignore 1234567 --ignore 7654321`,
    ]],
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Audit dependencies from all workspaces`,
  });

  recursive = Option.Boolean(`-R,--recursive`, false, {
    description: `Audit transitive dependencies as well`,
  });

  environment = Option.String(`--environment`, npmAuditTypes.Environment.All, {
    description: `Which environments to cover`,
    validator: t.isEnum(npmAuditTypes.Environment),
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  severity = Option.String(`--severity`, npmAuditTypes.Severity.Info, {
    description: `Minimal severity requested for packages to be displayed`,
    validator: t.isEnum(npmAuditTypes.Severity),
  });

  excludes = Option.Array(`--exclude`, [], {
    description: `Array of glob patterns of packages to exclude from audit`,
  });

  ignores = Option.Array(`--ignore`, [], {
    description: `Array of glob patterns of advisory ID's to ignore in the audit report`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const requires = npmAuditUtils.getRequires(project, workspace, {all: this.all, environment: this.environment});
    const dependencies = npmAuditUtils.getDependencies(project, workspace, {all: this.all});

    if (!this.recursive) {
      for (const key of Object.keys(dependencies)) {
        if (!Object.prototype.hasOwnProperty.call(requires, key)) {
          delete dependencies[key];
        } else {
          dependencies[key].requires = {};
        }
      }
    }

    const excludedPackages = Array.from(new Set([
      ...configuration.get(`npmAuditExcludePackages`),
      ...this.excludes,
    ]));

    if (excludedPackages) {
      for (const pkg of Object.keys(requires)) {
        if (micromatch.isMatch(pkg, excludedPackages)) {
          delete requires[pkg];
        }
      }

      for (const pkg of Object.keys(dependencies)) {
        if (micromatch.isMatch(pkg, excludedPackages)) {
          delete dependencies[pkg];
        }
      }

      for (const key of Object.keys(dependencies)) {
        for (const pkg of Object.keys(dependencies[key].requires)) {
          if (micromatch.isMatch(pkg, excludedPackages)) {
            delete dependencies[key].requires[pkg];
          }
        }
      }
    }

    const body = {
      requires,
      dependencies,
    };

    const registry = npmConfigUtils.getAuditRegistry(workspace.manifest, {
      configuration,
    });

    let result!: npmAuditTypes.AuditResponse;
    const httpReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      result = ((await npmHttpUtils.post(`/-/npm/v1/security/audits/quick`, body, {
        authType: npmHttpUtils.AuthType.BEST_EFFORT,
        configuration,
        jsonResponse: true,
        registry,
      })) as unknown) as npmAuditTypes.AuditResponse;
    });

    if (httpReport.hasErrors())
      return httpReport.exitCode();

    const ignoredAdvisories = Array.from(new Set([
      ...configuration.get(`npmAuditIgnoreAdvisories`),
      ...this.ignores,
    ]));

    if (ignoredAdvisories) {
      for (const advisory of Object.keys(result.advisories)) {
        if (micromatch.isMatch(advisory, ignoredAdvisories)) {
          const entry = result.advisories[advisory];
          result.metadata.vulnerabilities[entry.severity] -= 1;
          delete result.advisories[advisory];
        }
      }
    }

    const hasError = npmAuditUtils.isError(result.metadata.vulnerabilities, this.severity);
    if (!this.json && hasError) {
      treeUtils.emitTree(npmAuditUtils.getReportTree(result, this.severity), {
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        separators: 2,
      });
      return 1;
    }

    await StreamReport.start({
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

    return hasError ? 1 : 0;
  }
}
