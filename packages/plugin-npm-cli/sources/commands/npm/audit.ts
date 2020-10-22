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
      requires: this.getRequires(project, workspace),
      dependencies: this.getDependencies(project, workspace),
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

    const hasError = isError(result.metadata.vulnerabilities, this.severity);
    if (!this.json && hasError) {
      treeUtils.emitTree(getReportTree(result), {
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

  private getRequires(project: Project, workspace: Workspace) {
    const workspaces = this.all
      ? project.workspaces
      : [workspace];

    const includeDependencies = [
      npmAuditTypes.Environment.All,
      npmAuditTypes.Environment.Production,
    ].includes(this.environment);

    const requiredDependencies = [];
    if (includeDependencies)
      for (const workspace of workspaces)
        for (const dependency of workspace.manifest.dependencies.values())
          requiredDependencies.push(dependency);

    const includeDevDependencies = [
      npmAuditTypes.Environment.All,
      npmAuditTypes.Environment.Development,
    ].includes(this.environment);

    const requiredDevDependencies = [];
    if (includeDevDependencies)
      for (const workspace of workspaces)
        for (const dependency of workspace.manifest.devDependencies.values())
          requiredDevDependencies.push(dependency);

    return transformDescriptorIterableToRequiresObject([
      ...requiredDependencies,
      ...requiredDevDependencies,
    ].filter(dependency => {
      return structUtils.parseRange(dependency.range).protocol === null;
    }));
  }

  private getDependencies(project: Project, workspace: Workspace) {
    const transitiveDevDependencies = npmAuditUtils.getTransitiveDevDependencies(project, workspace, {all: this.all});

    const data: {
      [key: string]: {
        version: string;
        integrity: string;
        requires: {[key: string]: string};
        dev: boolean;
      },
    } = {};

    // BUG: Should be storedPackage
    for (const pkg of project.originalPackages.values()) {
      data[structUtils.stringifyIdent(pkg)] = {
        version: pkg.version ?? `0.0.0`,
        integrity: pkg.identHash,
        requires: transformDescriptorIterableToRequiresObject(pkg.dependencies.values()),
        dev: transitiveDevDependencies.has(structUtils.convertLocatorToDescriptor(pkg).descriptorHash),
      };
    }

    return data;
  }
}

function transformDescriptorIterableToRequiresObject(descriptors: Iterable<Descriptor>) {
  const data: {[key: string]: string} = {};

  for (const descriptor of descriptors)
    data[structUtils.stringifyIdent(descriptor)] = structUtils.parseRange(descriptor.range).selector;

  return data;
}

function getSeverityInclusions(severity?: npmAuditTypes.Severity): Set<npmAuditTypes.Severity> {
  if (typeof severity === `undefined`)
    return new Set();

  const allSeverities = [
    npmAuditTypes.Severity.Info,
    npmAuditTypes.Severity.Low,
    npmAuditTypes.Severity.Moderate,
    npmAuditTypes.Severity.High,
    npmAuditTypes.Severity.Critical,
  ];

  const severityIndex = allSeverities.indexOf(severity);
  const severities = allSeverities.slice(severityIndex);

  return new Set(severities);
}

function filterVulnerabilities(vulnerabilities: npmAuditTypes.AuditVulnerabilities, severity?: npmAuditTypes.Severity) {
  const inclusions = getSeverityInclusions(severity);

  const filteredVulnerabilities: Partial<npmAuditTypes.AuditVulnerabilities> = {};
  for (const key of inclusions)
    filteredVulnerabilities[key] = vulnerabilities[key];

  return filteredVulnerabilities;
}

function isError(vulnerabilities: npmAuditTypes.AuditVulnerabilities, severity?: npmAuditTypes.Severity): boolean {
  const filteredVulnerabilities = filterVulnerabilities(vulnerabilities, severity);

  for (const key of Object.keys(filteredVulnerabilities) as any as Array<npmAuditTypes.Severity>)
    if (filteredVulnerabilities[key] ?? 0 > 0)
      return true;

  return false;
}

function getReportTree(result: npmAuditTypes.AuditResponse) {
  const auditTreeChildren: treeUtils.TreeMap = {};
  const auditTree: treeUtils.TreeNode = {children: auditTreeChildren};

  Object.values(result.advisories).forEach(advisory => {
    auditTreeChildren[advisory.module_name] = {
      label: advisory.module_name,
      value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.findings.map(finding => finding.version).join(`, `)),
      children: {
        Issue: {
          label: `Issue`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.title),
        },
        URL: {
          label: `URL`,
          value: formatUtils.tuple(formatUtils.Type.URL, advisory.url),
        },
        Severity: {
          label: `Severity`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.severity),
        },
        [`Vulnerable Versions`]: {
          label: `Vulnerable Versions`,
          value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.vulnerable_versions),
        },
        [`Patched Versions`]: {
          label: `Patched Versions`,
          value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.patched_versions),
        },
        Recommendation: {
          label: `Recommendation`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.recommendation),
        },
        Paths: {
          children: pathListToTreeNode(advisory.findings.map(finding => finding.paths).flat()),
        },
      },
    };
  });

  return auditTree;
}

function pathListToTreeNode(paths: Array<string>): treeUtils.TreeMap {
  const result: Record<string, {value: formatUtils.Tuple, children: treeUtils.TreeMap}> = {};

  paths.map(path => path.split(`>`)).forEach(path => {
    let node: treeUtils.TreeMap = result;
    path.forEach(pkg => {
      node[pkg] = node[pkg] ?? {value: formatUtils.tuple(formatUtils.Type.NAME, pkg), children: {}};
      node = node[pkg].children as treeUtils.TreeMap;
    });
  });

  return result;
}
