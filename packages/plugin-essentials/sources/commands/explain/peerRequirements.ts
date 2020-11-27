import {BaseCommand}                                                                                         from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, Project, StreamReport, structUtils, semverUtils, formatUtils} from '@yarnpkg/core';
import {Command}                                                                                             from 'clipanion';
import {Writable}                                                                                            from 'stream';
import * as yup                                                                                              from 'yup';

// eslint-disable-next-line arca/no-default-export
export default class ExplainPeerRequirementsCommand extends BaseCommand {
  @Command.String({required: false})
  hash?: string;

  static schema = yup.object().shape({
    hash: yup.string().matches(/^[0-9a-f]{5}$/),
  });

  @Command.Path(`explain`, `peer-requirements`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    // peerRequirementSets aren't stored inside the install state
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
      const requirementSets: Array<{
        prettyHash: string,
        prettyParentLocator: string,
        prettyPeerRequest: string,
        prettyTopLevelLocator: string,
        descendantCount: number,
      }> = [];

      for (const [hash, {parentLocator, topLevelLocator, peerRequirements}] of project.peerRequirementSets) {
        const parentPackage = project.storedPackages.get(parentLocator);
        if (typeof parentPackage === `undefined`)
          throw new Error(`Assertion failed: Expected the parent package to have been registered`);

        const topLevelPackage = project.storedPackages.get(topLevelLocator);
        if (typeof topLevelPackage === `undefined`)
          throw new Error(`Assertion failed: Expected the top level package to have been registered`);

        requirementSets.push({
          prettyHash: formatUtils.pretty(configuration, hash, formatUtils.Type.CODE),
          prettyParentLocator: structUtils.prettyLocator(configuration, parentPackage),
          prettyPeerRequest: structUtils.prettyIdent(configuration, peerRequirements.providedPackage),
          prettyTopLevelLocator: structUtils.prettyLocator(configuration, topLevelPackage),
          descendantCount: peerRequirements.peerRequests.size - 1,
        });
      }

      for (const {prettyHash, prettyParentLocator, prettyPeerRequest, prettyTopLevelLocator, descendantCount} of miscUtils.sortMap(requirementSets, ({prettyParentLocator}) => prettyParentLocator)) {
        const pluralized = `descendant${descendantCount === 1 ? `` : `s`}`;
        const maybeDescendants = descendantCount > 0 ? ` and ${descendantCount} ${pluralized}` : ``;

        report.reportInfo(null, `${prettyHash} → ${prettyParentLocator} provides ${prettyPeerRequest} to ${prettyTopLevelLocator}${maybeDescendants}`);
      }
    });

    return report.exitCode();
  }
}

export async function explainPeerRequirements(peerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const {configuration} = project;

  const data = project.peerRequirementSets.get(peerRequirementsHash);
  if (typeof data === `undefined`)
    throw new Error(`No peerDependency requirements found for hash: "${peerRequirementsHash}"`);

  const {peerRequirements, parentLocator, topLevelLocator} = data;

  const report = await StreamReport.start({
    configuration,
    stdout: opts.stdout,
    includeFooter: false,
  }, async report => {
    const parentPackage = project.storedPackages.get(parentLocator);
    if (typeof parentPackage === `undefined`)
      throw new Error(`Assertion failed: Expected the parentPackage to have been registered`);

    const topLevelPackage = project.storedPackages.get(topLevelLocator);
    if (typeof topLevelPackage === `undefined`)
      throw new Error(`Assertion failed: Expected the top level package to have been registered`);
    const prettyTopLevelLocator = structUtils.prettyLocator(configuration, topLevelPackage);

    const ranges = [...peerRequirements.peerRequests.values()];
    const satisfiesAllRanges = ranges.every(range => semverUtils.satisfiesWithPrereleases(peerRequirements.providedPackage.version, range));

    const descendantCount = peerRequirements.peerRequests.size - 1;
    const plural = descendantCount !== 1;
    const maybeDescendants = descendantCount > 0 ? ` and${plural ? ` ${satisfiesAllRanges ? `all of` : `some of`}` : ``} its ${descendantCount} descendant${plural ? `s` : ``}` : ``;

    report.reportInfo(MessageName.UNNAMED, `${
      structUtils.prettyLocator(configuration, parentPackage)
    } provides ${
      structUtils.prettyLocator(configuration, peerRequirements.providedPackage)
    } with version ${
      structUtils.prettyReference(configuration, peerRequirements.providedPackage.version ?? `<missing>`)
    } which ${satisfiesAllRanges ? `satisfies` : `doesn't satisfy`} the requirements of ${prettyTopLevelLocator}${maybeDescendants}:`);

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
