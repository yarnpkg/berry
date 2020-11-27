import {BaseCommand}                                                                                         from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, Project, StreamReport, structUtils, semverUtils, formatUtils} from '@yarnpkg/core';
import {Command}                                                                                             from 'clipanion';
import {Writable}                                                                                            from 'stream';
import * as yup                                                                                              from 'yup';

// eslint-disable-next-line arca/no-default-export
export default class ExplainPeerRequirementsCommand extends BaseCommand {
  @Command.String()
  hash!: string;

  static schema = yup.object().shape({
    hash: yup.string().matches(/^[0-9a-f]+$/),
  });

  @Command.Path(`explain`, `peer-requirements`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    // mismatchedPeerRequirementSets aren't stored inside the install state
    await project.applyLightResolution();

    return await explainMismatchedPeerRequirements(this.hash, project, {
      stdout: this.context.stdout,
    });
  }
}

export async function explainMismatchedPeerRequirements(mismatchedPeerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const {configuration} = project;

  const data = project.mismatchedPeerRequirementSets.get(mismatchedPeerRequirementsHash);
  if (typeof data === `undefined`)
    throw new Error(`No mismatched peerDependency requirements found for hash: "${mismatchedPeerRequirementsHash}"`);

  const {peerRequirements, parentLocator} = data;

  const report = await StreamReport.start({
    configuration,
    stdout: opts.stdout,
    includeFooter: false,
  }, async report => {
    const parentPackage = project.storedPackages.get(parentLocator);
    if (typeof parentPackage === `undefined`)
      throw new Error(`Assertion failed: Expected the parentPackage to have been registered`);

    const firstLocatorHash = [...peerRequirements.peerRequests.keys()][0];
    const firstPackage = project.storedPackages.get(firstLocatorHash);
    if (typeof firstPackage === `undefined`)
      throw new Error(`Assertion failed: Expected the first package to have been registered`);
    const prettyFirstLocator = structUtils.prettyLocator(configuration, firstPackage);

    report.reportInfo(MessageName.UNNAMED, `${
      structUtils.prettyLocator(configuration, parentPackage)
    } provides ${
      structUtils.prettyLocator(configuration, peerRequirements.providedPackage)
    } which doesn't satisfy the requirements of ${prettyFirstLocator} and all of its descendants:`);

    report.reportSeparator();

    const Mark = formatUtils.mark(configuration);

    const requirements: Array<{
      stringifiedLocator: string,
      prettyLocator: string,
      prettyRange: string,
      mark: string
    }> = [];

    for (const [locatorHash, range] of peerRequirements.peerRequests) {
      const isSatisfied = semverUtils.satisfiesWithPrereleases(peerRequirements.providedPackage.version, range);
      const mark = isSatisfied ? Mark.Check : Mark.Cross;

      const pkg = project.storedPackages.get(locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: Expected the package to have been registered`);

      requirements.push({
        stringifiedLocator: structUtils.stringifyLocator(pkg),
        prettyLocator: structUtils.prettyLocator(configuration, pkg),
        prettyRange: structUtils.prettyRange(configuration, range),
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
  });

  return report.exitCode();
}
