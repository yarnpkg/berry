import {BaseCommand, WorkspaceRequiredError}                                                                                        from '@yarnpkg/cli';
import {Configuration, Descriptor, Project, ReportError, StreamReport, MessageName, Workspace, formatUtils, structUtils, treeUtils} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils}                                                                                               from '@yarnpkg/plugin-npm';
import {Command, Usage}                                                                                                             from 'clipanion';

import {getTransitiveDevDependencies}                                                                                               from './auditUtils';

export enum Environment {
  All = `all`,
  Production = `production`,
  Development = `development`,
}

export enum Severity {
  Info = `info`,
  Low = `low`,
  Moderate = `moderate`,
  High = `high`,
  Critical = `critical`,
}

interface AuditResolution {
  id: number;
  path: string;
  dev: boolean;
  optional: boolean;
  bundled: boolean;
}

interface AuditAction {
  action: string;
  module: string;
  target: string;
  isMajor: boolean;
  resolves: Array<AuditResolution>;
}

interface AuditAdvisory {
  findings: Array<{
    version: string;
    paths: Array<string>;
    dev: boolean;
    optional: boolean;
    bundled: boolean;
  }>;
  id: number;
  created: string;
  updated: string;
  deleted?: boolean;
  title: string;
  found_by: {
    name: string;
  };
  reported_by: {
    name: string;
  };
  module_name: string;
  cves: Array<string>;
  vulnerable_versions: string;
  patched_versions: string;
  overview: string;
  recommendation: string;
  references: string;
  access: string;
  severity: string;
  cwe: string;
  metadata: {
    module_type: string;
    exploitability: number;
    affected_components: string;
  };
  url: string;
}

type AuditVulnerabilities = {
  [severity in Severity]: number;
};

interface AuditMetadata {
  vulnerabilities: AuditVulnerabilities;
  dependencies: number;
  devDependencies: number;
  optionalDependencies: number;
  totalDependencies: number;
}

interface AuditResponse {
  actions: Array<AuditAction>;
  advisories: { [key: string]: AuditAdvisory };
  muted: Array<Object>;
  metadata: AuditMetadata;
}

// eslint-disable-next-line arca/no-default-export
export default class AuditCommand extends BaseCommand {
  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.String(`--environment`)
  environment: Environment = Environment.All;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.String(`--severity`)
  severity: Severity = Severity.Info;

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
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );
    const {project, workspace} = await Project.find(
      configuration,
      this.context.cwd,
    );

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const report = await StreamReport.start(
      {
        configuration,
        includeFooter: false,
        json: this.json,
        stdout: this.context.stdout,
      },
      async report => {
        const body = {
          requires: this.getRequires(project, workspace),
          dependencies: this.getDependencies(project, workspace),
        };
        const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {
          configuration,
        });

        let result: AuditResponse;
        try {
          const url = `/-/npm/v1/security/audits/quick`;
          result = ((await npmHttpUtils.post(url, body, {
            authType: npmHttpUtils.AuthType.NO_AUTH,
            configuration,
            jsonResponse: true,
            registry,
          })) as unknown) as AuditResponse;
        } catch (err) {
          if (err.name !== `HTTPError`) {
            throw err;
          } else {
            throw new ReportError(MessageName.EXCEPTION, err.toString());
          }
        }

        report.reportJson(result);

        if (isError(result.metadata.vulnerabilities, this.severity)) {
          const auditTree = getReportTree(result);
          treeUtils.emitTree(auditTree, {
            configuration,
            json: this.json,
            stdout: this.context.stdout,
            separators: 2,
          });
        } else {
          report.reportInfo(
            null,
            `${Object.values(result.metadata.vulnerabilities).reduce((acc, cur) => acc + cur, 0)} vulnerabilities found in ${result.metadata.totalDependencies} packages audited.`,
          );
        }
      }
    );

    return report.exitCode();
  }

  private getRequires(project: Project, workspace: Workspace) {
    const workspaces = this.all ? project.workspaces : [workspace];

    const includeDependencies = [Environment.All, Environment.Production].includes(this.environment);
    const requiredDependencies = includeDependencies ? workspaces.reduce(
      (acc, workspace) => [
        ...acc,
        ...workspace.manifest.dependencies.values(),
      ],
      new Array(),
    ) : [];

    const includeDevDependencies = [Environment.All, Environment.Development].includes(this.environment);
    const requiredDevDependencies = includeDevDependencies ? workspaces.reduce(
      (acc, workspace) => [
        ...acc,
        ...workspace.manifest.devDependencies.values(),
      ],
      new Array(),
    ) : [];

    return transformDescriptorIterableToRequiresObject([
      ...requiredDependencies,
      ...requiredDevDependencies,
    ]);
  }

  private getDependencies(project: Project, workspace: Workspace) {
    const transitiveDevDependencies = getTransitiveDevDependencies(
      project,
      workspace,
      {
        all: this.all,
      },
    );

    return Array.from(
      project.originalPackages.values(),
    ).reduce(
      (acc, cur) => ({
        ...acc,
        [structUtils.stringifyIdent(cur)]: {
          version: cur.version,
          integrity: cur.identHash,
          requires: transformDescriptorIterableToRequiresObject(
            cur.dependencies.values(),
          ),
          dev: transitiveDevDependencies.has(
            structUtils.convertLocatorToDescriptor(
              structUtils.convertPackageToLocator(cur),
            ).descriptorHash,
          ),
        },
      }),
      {},
    );
  }
}

function transformDescriptorIterableToRequiresObject(
  descriptors: Iterable<Descriptor>,
): { [key: string]: string } {
  return Array.from(descriptors).reduce(
    (acc, cur) => ({
      ...acc,
      [structUtils.stringifyIdent(cur)]: cur.range,
    }),
    {}
  );
}

function getSeverityInclusions(severity?: Severity): Set<Severity> {
  switch (severity) {
    case Severity.Info:
      return new Set([
        Severity.Info,
        Severity.Low,
        Severity.Moderate,
        Severity.High,
        Severity.Critical,
      ]);
    case Severity.Low:
      return new Set([
        Severity.Low,
        Severity.Moderate,
        Severity.High,
        Severity.Critical,
      ]);
    case Severity.Moderate:
      return new Set([Severity.Moderate, Severity.High, Severity.Critical]);
    case Severity.High:
      return new Set([Severity.High, Severity.Critical]);
    case Severity.Critical:
      return new Set([Severity.Critical]);
    default:
      return new Set();
  }
}

function filterVulnerabilities(
  vulnerabilities: AuditVulnerabilities,
  severity?: Severity,
): AuditVulnerabilities {
  const inclusions = getSeverityInclusions(severity);
  return Object.keys(vulnerabilities)
    .filter(key => inclusions.has(key as Severity))
    .reduce(
      (acc, cur) => ({
        ...acc,
        [cur]: vulnerabilities[cur as Severity],
      }),
      {},
    ) as AuditVulnerabilities;
}

function isError(
  vulnerabilities: AuditVulnerabilities,
  severity?: Severity,
): boolean {
  return (
    Object.values(filterVulnerabilities(vulnerabilities, severity)).reduce(
      (acc, cur) => acc + cur,
      0,
    ) > 0
  );
}

function getReportTree(result: AuditResponse): treeUtils.TreeNode {
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
