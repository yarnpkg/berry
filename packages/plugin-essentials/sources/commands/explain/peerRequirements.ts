import {BaseCommand}                                                                                               from '@yarnpkg/cli';
import {Configuration, MessageName, Project, StreamReport, structUtils, semverUtils, formatUtils, PeerWarningType} from '@yarnpkg/core';
import {Command, Option}                                                                                           from 'clipanion';
import {Writable}                                                                                                  from 'stream';
import * as t                                                                                                      from 'typanion';

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
    validator: t.cascade(t.isString(), [
      t.matchesRegExp(/^p[0-9a-f]{5}$/),
    ]),
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    await project.applyLightResolution();

    return await explainPeerRequirements(this.hash, project, {
      stdout: this.context.stdout,
    });
  }
}

export async function explainPeerRequirements(peerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const warning = project.peerWarnings.find(warning => {
    return warning.hash === peerRequirementsHash;
  });

  if (typeof warning === `undefined`)
    throw new Error(`No peerDependency requirements found for hash: "${peerRequirementsHash}"`);

  const report = await StreamReport.start({
    configuration: project.configuration,
    stdout: opts.stdout,
    includeFooter: false,
    includePrefix: false,
  }, async report => {
    const Marks = formatUtils.mark(project.configuration);

    switch (warning.type) {
      case PeerWarningType.NotCompatibleAggregate: {
        report.reportInfo(MessageName.UNNAMED, `We have a problem with ${formatUtils.pretty(project.configuration, warning.requested, formatUtils.Type.IDENT)}, which is provided with version ${structUtils.prettyReference(project.configuration, warning.version)}.`);
        report.reportInfo(MessageName.UNNAMED, `It is needed by the following direct dependencies of workspaces in your project:`);

        report.reportSeparator();

        for (const dependent of warning.requesters.values()) {
          const dependentPkg = project.storedPackages.get(dependent.locatorHash);
          if (!dependentPkg)
            throw new Error(`Assertion failed: Expected the package to be registered`);

          const descriptor = dependentPkg?.peerDependencies.get(warning.requested.identHash);
          if (!descriptor)
            throw new Error(`Assertion failed: Expected the package to list the peer dependency`);

          const mark = semverUtils.satisfiesWithPrereleases(warning.version, descriptor.range)
            ? Marks.Check
            : Marks.Cross;

          report.reportInfo(null, `  ${mark} ${structUtils.prettyLocator(project.configuration, dependent)} (via ${structUtils.prettyRange(project.configuration, descriptor.range)})`);
        }

        const transitiveLinks = [...warning.links.values()].filter(link => {
          return !warning.requesters.has(link.locatorHash);
        });

        if (transitiveLinks.length > 0) {
          report.reportSeparator();
          report.reportInfo(MessageName.UNNAMED, `However, those packages themselves have more dependencies listing ${structUtils.prettyIdent(project.configuration, warning.requested)} as peer dependency:`);
          report.reportSeparator();

          for (const link of transitiveLinks) {
            const linkPkg = project.storedPackages.get(link.locatorHash);
            if (!linkPkg)
              throw new Error(`Assertion failed: Expected the package to be registered`);

            const descriptor = linkPkg?.peerDependencies.get(warning.requested.identHash);
            if (!descriptor)
              throw new Error(`Assertion failed: Expected the package to list the peer dependency`);

            const mark = semverUtils.satisfiesWithPrereleases(warning.version, descriptor.range)
              ? Marks.Check
              : Marks.Cross;

            report.reportInfo(null, `  ${mark} ${structUtils.prettyLocator(project.configuration, link)} (via ${structUtils.prettyRange(project.configuration, descriptor.range)})`);
          }
        }

        const allRanges = Array.from(warning.links.values(), locator => {
          const pkg = project.storedPackages.get(locator.locatorHash);
          if (typeof pkg === `undefined`)
            throw new Error(`Assertion failed: Expected the package to be registered`);

          const peerDependency = pkg.peerDependencies.get(warning.requested.identHash);
          if (typeof peerDependency === `undefined`)
            throw new Error(`Assertion failed: Expected the ident to be registered`);

          return peerDependency.range;
        });

        if (allRanges.length > 1) {
          const resolvedRange = semverUtils.simplifyRanges(allRanges);

          report.reportSeparator();

          if (resolvedRange === null) {
            report.reportInfo(MessageName.UNNAMED, `Unfortunately, put together, we found no single range that can satisfy all those peer requirements.`);
            report.reportInfo(MessageName.UNNAMED, `Your best option may be to try to upgrade some dependencies with ${formatUtils.pretty(project.configuration, `yarn up`, formatUtils.Type.CODE)}, or silence the warning via ${formatUtils.pretty(project.configuration, `logFilters`, formatUtils.Type.CODE)}.`);
          } else {
            report.reportInfo(MessageName.UNNAMED, `Put together, the final range we computed is ${formatUtils.pretty(project.configuration, resolvedRange, formatUtils.Type.RANGE)}`);
          }
        }
      } break;

      default: {
        report.reportInfo(MessageName.UNNAMED, `The ${formatUtils.pretty(project.configuration, `yarn explain peer-requirements`, formatUtils.Type.CODE)} command doesn't support this warning type yet.`);
      } break;
    }
  });

  return report.exitCode();
}
