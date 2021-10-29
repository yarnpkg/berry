import {BaseCommand}                                                                                                          from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, Project, StreamReport, structUtils, semverUtils, formatUtils, PeerRequirement} from '@yarnpkg/core';
import {Command, Option}                                                                                                      from 'clipanion';
import {Writable}                                                                                                             from 'stream';
import * as t                                                                                                                 from 'typanion';

// eslint-disable-next-line arca/no-default-export
export default class ExplainPeerRequirementsCommand extends BaseCommand {
  static paths = [
    [`explain`, `peer-requirements`],
  ];

  static usage = Command.Usage({
    description: `explain a set of peer requirements`,
    details: `
      A set of peer requirements represents all peer requirements that a dependent must satisfy when providing a given peer request to a requester and its descendants.

      When the hash argument is specified, this command prints a detailed explanation of all requirements of the set corresponding to the hash and whether they're satisfied or not.

      When used without arguments, this command lists all sets of peer requirements and the corresponding hash that can be used to get detailed information about a given set.

      **Note:** A hash is a six-letter p-prefixed code that can be obtained from peer dependency warnings or from the list of all peer requirements (\`yarn explain peer-requirements\`).
    `,
    examples: [[
      `Explain the corresponding set of peer requirements for a hash`,
      `$0 explain peer-requirements p1a4ed`,
    ], [
      `List all sets of peer requirements`,
      `$0 explain peer-requirements`,
    ]],
  });

  hash = Option.String({
    required: false,
    validator: t.applyCascade(t.isString(), [
      t.matchesRegExp(/^p[0-9a-f]{5}$/),
    ]),
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    // peerRequirements aren't stored inside the install state
    await project.applyLightResolution();

    if (typeof this.hash !== `undefined`) {
      return await explainPeerRequirements(this.hash, project, {
        stdout: this.context.stdout,
      });
    }

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeFooter: false,
    }, async report => {
      const sortCriterias: Array<(opts: [string, PeerRequirement]) => string> = [
        ([, requirement]) => structUtils.stringifyLocator(project.storedPackages.get(requirement.subject)!),
        ([, requirement]) => structUtils.stringifyIdent(requirement.requested),
      ];

      for (const [hash, requirement] of miscUtils.sortMap(project.peerRequirements, sortCriterias)) {
        const subject = project.storedPackages.get(requirement.subject);
        if (typeof subject === `undefined`)
          throw new Error(`Assertion failed: Expected the subject package to have been registered`);

        const rootRequester = project.storedPackages.get(requirement.rootRequester);
        if (typeof rootRequester === `undefined`)
          throw new Error(`Assertion failed: Expected the root package to have been registered`);

        const providedDescriptor = subject.dependencies.get(requirement.requested.identHash) ?? null;

        const prettyHash = formatUtils.pretty(configuration, hash, formatUtils.Type.CODE);
        const prettySubject = structUtils.prettyLocator(configuration, subject);
        const prettyIdent = structUtils.prettyIdent(configuration, requirement.requested);
        const prettyRoot = structUtils.prettyIdent(configuration, rootRequester);

        const descendantCount = requirement.allRequesters.length - 1;

        const pluralized = `descendant${descendantCount === 1 ? `` : `s`}`;
        const maybeDescendants = descendantCount > 0 ? ` and ${descendantCount} ${pluralized}` : ``;
        const provides = providedDescriptor !== null ? `provides` : `doesn't provide`;

        report.reportInfo(null, `${prettyHash} → ${prettySubject} ${provides} ${prettyIdent} to ${prettyRoot}${maybeDescendants}`);
      }
    });

    return report.exitCode();
  }
}

export async function explainPeerRequirements(peerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const {configuration} = project;

  const requirement = project.peerRequirements.get(peerRequirementsHash);
  if (typeof requirement === `undefined`)
    throw new Error(`No peerDependency requirements found for hash: "${peerRequirementsHash}"`);

  const report = await StreamReport.start({
    configuration,
    stdout: opts.stdout,
    includeFooter: false,
  }, async report => {
    const subject = project.storedPackages.get(requirement.subject);
    if (typeof subject === `undefined`)
      throw new Error(`Assertion failed: Expected the subject package to have been registered`);

    const rootRequester = project.storedPackages.get(requirement.rootRequester);
    if (typeof rootRequester === `undefined`)
      throw new Error(`Assertion failed: Expected the root package to have been registered`);

    const providedDescriptor = subject.dependencies.get(requirement.requested.identHash) ?? null;

    const providedResolution = providedDescriptor !== null
      ? project.storedResolutions.get(providedDescriptor.descriptorHash)
      : null;

    if (typeof providedResolution === `undefined`)
      throw new Error(`Assertion failed: Expected the resolution to have been registered`);

    const provided = providedResolution !== null
      ? project.storedPackages.get(providedResolution)
      : null;

    if (typeof provided === `undefined`)
      throw new Error(`Assertion failed: Expected the provided package to have been registered`);

    const allRequesters = [...requirement.allRequesters.values()].map(requesterHash => {
      const pkg = project.storedPackages.get(requesterHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: Expected the package to be registered`);

      const devirtualizedLocator = structUtils.devirtualizeLocator(pkg);
      const devirtualizedPkg = project.storedPackages.get(devirtualizedLocator.locatorHash);
      if (typeof devirtualizedPkg === `undefined`)
        throw new Error(`Assertion failed: Expected the package to be registered`);

      const peerDependency = devirtualizedPkg.peerDependencies.get(requirement.requested.identHash);
      if (typeof peerDependency === `undefined`)
        throw new Error(`Assertion failed: Expected the peer dependency to be registered`);

      return {pkg, peerDependency};
    });

    if (provided !== null) {
      const satisfiesAllRanges = allRequesters.every(({peerDependency}) => {
        return semverUtils.satisfiesWithPrereleases(provided.version, peerDependency.range);
      });

      report.reportInfo(MessageName.UNNAMED, `${
        structUtils.prettyLocator(configuration, subject)
      } provides ${
        structUtils.prettyLocator(configuration, provided)
      } with version ${
        structUtils.prettyReference(configuration, provided.version ?? `<missing>`)
      }, which ${satisfiesAllRanges ? `satisfies` : `doesn't satisfy`} the following requirements:`);
    } else {
      report.reportInfo(MessageName.UNNAMED, `${
        structUtils.prettyLocator(configuration, subject)
      } doesn't provide ${
        structUtils.prettyIdent(configuration, requirement.requested)
      }, breaking the following requirements:`);
    }

    report.reportSeparator();

    const Mark = formatUtils.mark(configuration);

    const requirements: Array<{
      stringifiedLocator: string;
      prettyLocator: string;
      prettyRange: string;
      mark: string;
    }> = [];

    for (const {pkg, peerDependency} of miscUtils.sortMap(allRequesters, requester => structUtils.stringifyLocator(requester.pkg))) {
      const isSatisfied = provided !== null
        ? semverUtils.satisfiesWithPrereleases(provided.version, peerDependency.range)
        : false;

      const mark = isSatisfied ? Mark.Check : Mark.Cross;

      requirements.push({
        stringifiedLocator: structUtils.stringifyLocator(pkg),
        prettyLocator: structUtils.prettyLocator(configuration, pkg),
        prettyRange: structUtils.prettyRange(configuration, peerDependency.range),
        mark,
      });
    }

    const maxStringifiedLocatorLength = Math.max(...requirements.map(({stringifiedLocator}) => stringifiedLocator.length));
    const maxPrettyRangeLength = Math.max(...requirements.map(({prettyRange}) => prettyRange.length));

    for (const {stringifiedLocator, prettyLocator, prettyRange, mark} of miscUtils.sortMap(requirements, ({stringifiedLocator}) => stringifiedLocator)) {
      report.reportInfo(null, `${
        // We have to do this because prettyLocators can contain multiple colors
        prettyLocator.padEnd(maxStringifiedLocatorLength + (prettyLocator.length - stringifiedLocator.length), ` `)
      } → ${
        prettyRange.padEnd(maxPrettyRangeLength, ` `)
      } ${mark}`);
    }

    if (requirements.length > 1) {
      report.reportSeparator();

      report.reportInfo(MessageName.UNNAMED, `Note: these requirements start with ${
        structUtils.prettyLocator(project.configuration, rootRequester)
      }`);
    }
  });

  return report.exitCode();
}
