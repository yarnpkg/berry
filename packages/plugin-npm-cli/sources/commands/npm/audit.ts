import {BaseCommand, WorkspaceRequiredError}                                                                from '@yarnpkg/cli';
import {Configuration, Descriptor, Project, ReportError, StreamReport, MessageName, structUtils, treeUtils} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils}                                                                       from '@yarnpkg/plugin-npm';
import {Command, Usage}                                                                                     from 'clipanion';

import {getTransitiveDevDependencies}                                                                       from './auditUtils';

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
  @Command.String(`--severity`)
  severity: Severity = Severity.Info;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `perform a vulnerability audit against the installed packages`,
    details: `
      Checks for known security issues with the installed packages. The output is a list of known issues.

      You must be online to perform the audit.

      Applying the severity flag will limit the audit table to vulnerabilities of the corresponding severity and above.

      For scripting purposes, yarn audit also supports the --json flag, which will output the details for the issues in JSON-lines format (one JSON object per line) instead of plain text.
    `,
    examples: [[
      `Checks for known security issues with the installed packages. The output is a list of known issues.`,
      `yarn npm audit`,
    ], [
      `Output moderate (or more severe) vulnerabilities`,
      `yarn npm audit --severity moderate`,
    ], [
      `Show audit report as valid JSON`,
      `yarn npm audit --json`,
    ]],
  });

  @Command.Path(`npm`, `audit`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const requiredDependencies = project.workspaces.reduce((acc, workspace) =>
        [...acc, ...workspace.manifest.dependencies.values()], new Array());
      const requiredDevDependencies = project.workspaces.reduce((acc, workspace) =>
        [...acc, ...workspace.manifest.devDependencies.values()], new Array());
      const requires = transformDescriptorIterableToRequiresObject([...requiredDependencies, ...requiredDevDependencies]);

      const transitiveDevDependencies = getTransitiveDevDependencies(project, workspace);
      const dependencies = Array.from(project.originalPackages.values()).reduce((acc, cur) => ({
        ...acc, [structUtils.stringifyIdent(cur)]: {
          version: cur.version,
          integrity: cur.identHash,
          requires: transformDescriptorIterableToRequiresObject(cur.dependencies.values()),
          dev: transitiveDevDependencies.has(structUtils.convertLocatorToDescriptor(structUtils.convertPackageToLocator(cur)).descriptorHash),
        },
      }), {});

      const body = {
        requires,
        dependencies,
      };
      const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {configuration});

      let result: AuditResponse;
      try {
        const url = `/-/npm/v1/security/audits`;
        result = (await npmHttpUtils.post(url, body, {
          authType: npmHttpUtils.AuthType.NO_AUTH,
          configuration,
          jsonResponse: true,
          registry,
        }) as unknown) as AuditResponse;
      } catch (err) {
        if (err.name !== `HTTPError`) {
          throw err;
        } else {
          throw new ReportError(MessageName.EXCEPTION, err.toString());
        }
      }

      report.reportJson(result);

      if (isError(result.metadata.vulnerabilities, this.severity)) {
        report.reportError(MessageName.EXCEPTION, JSON.stringify(result, undefined, 2));
        const auditTreeChildren: treeUtils.TreeMap = {};
        const auditTree: treeUtils.TreeNode = {children: auditTreeChildren};
        treeUtils.emitTree(auditTree, {
          configuration,
          json: this.json,
          stdout: this.context.stdout,
          separators: 2,
        });
      }
    });

    return report.exitCode();
  }
}

function transformDescriptorIterableToRequiresObject(descriptors: Iterable<Descriptor>): { [key: string]: string } {
  return Array.from(descriptors).reduce((acc, cur) => ({
    ...acc, [structUtils.stringifyIdent(cur)]: cur.range,
  }), {});
}

function getSeverityInclusions(severity?: Severity): Set<Severity> {
  switch (severity) {
    case Severity.Info:
      return new Set([Severity.Info, Severity.Low, Severity.Moderate, Severity.High, Severity.Critical]);
    case Severity.Low:
      return new Set([Severity.Low, Severity.Moderate, Severity.High, Severity.Critical]);
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

function filterVulnerabilities(vulnerabilities: AuditVulnerabilities, severity?: Severity): AuditVulnerabilities {
  const inclusions = getSeverityInclusions(severity);
  return Object.keys(vulnerabilities).filter(key => inclusions.has(key as Severity)).reduce((acc, cur) => ({
    ...acc,
    [cur]: vulnerabilities[cur as Severity],
  }), {}) as AuditVulnerabilities;
}

function isError(vulnerabilities: AuditVulnerabilities, severity?: Severity): boolean {
  return Object.values(filterVulnerabilities(vulnerabilities, severity)).reduce((acc, cur) => acc + cur, 0) > 0;
}
