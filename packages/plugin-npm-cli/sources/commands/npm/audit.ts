import {BaseCommand, WorkspaceRequiredError}                                                                                     from '@yarnpkg/cli';
import {Configuration, Project, MessageName, treeUtils, LightReport, StreamReport, semverUtils, LocatorHash, Locator, miscUtils} from '@yarnpkg/core';
import {structUtils}                                                                                                             from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils}                                                                                            from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                                                                                  from 'clipanion';
import micromatch                                                                                                                from 'micromatch';
import * as t                                                                                                                    from 'typanion';

import * as npmAuditTypes                                                                                                        from '../../npmAuditTypes';
import * as npmAuditUtils                                                                                                        from '../../npmAuditUtils';

// eslint-disable-next-line arca/no-default-export
export default class NpmAuditCommand extends BaseCommand {
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

  noDeprecations = Option.Boolean(`--no-deprecations`, false, {
    description: `Don't warn about deprecated packages`,
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

    const topLevelDependencies = npmAuditUtils.getTopLevelDependencies(project, workspace, {all: this.all, environment: this.environment});
    const packages = npmAuditUtils.getPackages(project, topLevelDependencies, {recursive: this.recursive});

    const excludedPackages = Array.from(new Set([
      ...configuration.get(`npmAuditExcludePackages`),
      ...this.excludes,
    ]));

    const payload = Object.create(null);

    for (const [packageName, versions] of packages)
      if (!excludedPackages.some(pattern => micromatch.isMatch(packageName, pattern)))
        payload[packageName] = [...versions.keys()];

    const registry = npmConfigUtils.getAuditRegistry({configuration});

    let result!: npmAuditTypes.AuditResponse;
    const httpReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      // Note: No `await` there, so that the request is sent in parallel with the deprecation checks
      const auditRequest = npmHttpUtils.post(`/-/npm/v1/security/advisories/bulk`, payload, {
        authType: npmHttpUtils.AuthType.BEST_EFFORT,
        configuration,
        jsonResponse: true,
        registry,
      }) as unknown as Promise<npmAuditTypes.AuditResponse>;

      const deprecations = await Promise.all(this.noDeprecations ? [] : Array.from(packages, async ([packageName, versions]) => {
        const registryData = await npmHttpUtils.getPackageMetadata(structUtils.parseIdent(packageName), {
          project,
        });

        return miscUtils.mapAndFilter(versions.keys(), version => {
          const {deprecated} = registryData.versions[version];

          // Apparently some packages have a `deprecated` field set to an empty string
          // (even though that shouldn't be possible since `npm deprecate ... ""` undeprecates
          // the package, completely removing the `deprecated` field). Both the npm website
          // and all other package managers skip showing deprecation warnings in this case.
          if (!deprecated)
            return miscUtils.mapAndFilter.skip;

          return [packageName, version, deprecated] as const;
        });
      }));

      const auditResult = await auditRequest;

      for (const [packageName, version, message] of deprecations.flat(1)) {
        // No need to report the deprecation audit message if the package is already reported as vulnerable
        if (Object.hasOwn(auditResult, packageName))
          if (auditResult[packageName].some(advisory => semverUtils.satisfiesWithPrereleases(version, advisory.vulnerable_versions)))
            continue;

        auditResult[packageName] ??= [];
        auditResult[packageName].push({
          id: `${packageName} (deprecation)`,
          title: message.trim() || `This package has been deprecated.`,
          severity: npmAuditTypes.Severity.Moderate,
          vulnerable_versions: version,
        });
      }

      result = auditResult;
    });

    if (httpReport.hasErrors())
      return httpReport.exitCode();

    const severities = npmAuditUtils.getSeverityInclusions(this.severity);

    const ignoredAdvisories = Array.from(new Set([
      ...configuration.get(`npmAuditIgnoreAdvisories`),
      ...this.ignores,
    ]));

    const expandedResult: npmAuditTypes.AuditExtendedResponse = Object.create(null);

    for (const [packageName, advisories] of Object.entries(result)) {
      const filteredAdvisories = advisories.filter(advisory => {
        return !micromatch.isMatch(`${advisory.id}`, ignoredAdvisories) && severities.has(advisory.severity);
      });

      if (filteredAdvisories.length > 0) {
        expandedResult[packageName] = filteredAdvisories.map(advisory => {
          const packageVersions = packages.get(packageName);
          if (typeof packageVersions === `undefined`)
            throw new Error(`Assertion failed: Expected the registry to only return packages that were requested`);

          const versions = [...packageVersions.keys()].filter(version => {
            return semverUtils.satisfiesWithPrereleases(version, advisory.vulnerable_versions);
          });

          const dependents = new Map<LocatorHash, Locator>();
          for (const version of versions)
            for (const pkg of packageVersions.get(version)!)
              dependents.set(pkg.locatorHash, pkg);

          return {
            ...advisory,
            versions,
            dependents: [...dependents.values()],
          };
        });
      }
    }

    const hasError = Object.keys(expandedResult).length > 0;

    if (!this.json && hasError) {
      treeUtils.emitTree(npmAuditUtils.getReportTree(expandedResult), {
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
