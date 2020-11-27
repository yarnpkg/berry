import {BaseCommand}                                                                                         from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, Project, StreamReport, structUtils, semverUtils, formatUtils} from '@yarnpkg/core';
import {Command}                                                                                             from 'clipanion';
import {Writable}                                                                                            from 'stream';
import * as yup                                                                                              from 'yup';

// eslint-disable-next-line arca/no-default-export
export default class ExplainPeerChainCommand extends BaseCommand {
  @Command.String()
  hash!: string;

  static schema = yup.object().shape({
    hash: yup.string().matches(/^[0-9a-f]+$/),
  });

  @Command.Path(`explain`, `peer-chain`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    await project.restoreInstallState();

    return await explainMismatchedPeerChain(this.hash, project, {
      stdout: this.context.stdout,
    });
  }
}

export async function explainMismatchedPeerChain(mismatchedPeerChainHash: string, project: Project, opts: {stdout: Writable}) {
  const {configuration} = project;

  const data = project.mismatchedPeerChains.get(mismatchedPeerChainHash);
  if (typeof data === `undefined`)
    throw new Error(`No mismatched peerDependency chain found for hash: "${mismatchedPeerChainHash}"`);

  const {peerChain, parentLocator} = data;

  const report = await StreamReport.start({
    configuration,
    stdout: opts.stdout,
    includeFooter: false,
  }, async report => {
    const parentPackage = project.storedPackages.get(parentLocator);
    if (typeof parentPackage === `undefined`)
      throw new Error(`Assertion failed: Expected the parentPackage to have been registered`);

    report.reportInfo(MessageName.UNNAMED, `${
      structUtils.prettyLocator(configuration, parentPackage)
    } provides ${
      structUtils.prettyLocator(configuration, peerChain.providedPackage)
    } which doesn't satisfy the requirements of all descendants in the chain:`);

    report.reportSeparator();

    const requirements: Array<{
      stringifiedLocator: string,
      prettyLocator: string,
      prettyRange: string,
      marker: string
    }> = [];

    for (const [locatorHash, range] of peerChain.peerRequests) {
      const isSatisfied = semverUtils.satisfiesWithPrereleases(peerChain.providedPackage.version, range);
      const marker = isSatisfied
        ? formatUtils.pretty(configuration, `✓`, `green`)
        : formatUtils.pretty(configuration, `✘`, `red`);

      const pkg = project.storedPackages.get(locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: Expected the package to have been registered`);

      requirements.push({
        stringifiedLocator: structUtils.stringifyLocator(pkg),
        prettyLocator: structUtils.prettyLocator(configuration, pkg),
        prettyRange: structUtils.prettyRange(configuration, range),
        marker,
      });
    }

    const maxStringifiedLocatorLength = Math.max(...requirements.map(({stringifiedLocator}) => stringifiedLocator.length));
    const maxPrettyRangeLength = Math.max(...requirements.map(({prettyRange}) => prettyRange.length));

    for (const {stringifiedLocator, prettyLocator, prettyRange, marker} of miscUtils.sortMap(requirements, ({stringifiedLocator}) => stringifiedLocator)) {
      report.reportInfo(null, `${
        // We have to do this because prettyLocators can contain multiple colors
        prettyLocator.padEnd(maxStringifiedLocatorLength + (prettyLocator.length - stringifiedLocator.length), ` `)
      } → ${
        prettyRange.padEnd(maxPrettyRangeLength, ` `)
      } ${marker}`);
    }
  });

  return report.exitCode();
}
