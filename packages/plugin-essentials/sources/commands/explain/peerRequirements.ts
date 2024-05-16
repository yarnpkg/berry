import {BaseCommand}                                                                                                                          from '@yarnpkg/cli';
import type {PeerRequestNode}                                                                                                                 from '@yarnpkg/core/sources/Project';
import {Configuration, MessageName, Project, StreamReport, structUtils, formatUtils, treeUtils, PeerWarningType, miscUtils, type LocatorHash} from '@yarnpkg/core';
import {Command, Option}                                                                                                                      from 'clipanion';
import {Writable}                                                                                                                             from 'stream';
import * as t                                                                                                                                 from 'typanion';

// eslint-disable-next-line arca/no-default-export
export default class ExplainPeerRequirementsCommand extends BaseCommand {
  static paths = [
    [`explain`, `peer-requirements`],
  ];

  static usage = Command.Usage({
    description: `explain a set of peer requirements`,
    details: `
      A peer requirement represents all peer requests that a subject must satisfy when providing a requested package to requesters.

      When the hash argument is specified, this command prints a detailed explanation of the peer requirement corresponding to the hash and whether it is satisfied or not.

      When used without arguments, this command lists all peer requirements and the corresponding hash that can be used to get detailed information about a given requirement.

      **Note:** A hash is a six-letter p-prefixed code that can be obtained from peer dependency warnings or from the list of all peer requirements (\`yarn explain peer-requirements\`).
    `,
    examples: [[
      `Explain the corresponding peer requirement for a hash`,
      `$0 explain peer-requirements p1a4ed`,
    ], [
      `List all peer requirements`,
      `$0 explain peer-requirements`,
    ]],
  });

  hash = Option.String({
    required: false,
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

    if (typeof this.hash !== `undefined`) {
      return await explainPeerRequirement(this.hash, project, {
        stdout: this.context.stdout,
      });
    } else {
      return await explainPeerRequirements(project, {
        stdout: this.context.stdout,
      });
    }
  }
}

export async function explainPeerRequirement(peerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const root = project.peerRequirementNodes.get(peerRequirementsHash);
  if (typeof root === `undefined`)
    throw new Error(`No peerDependency requirements found for hash: "${peerRequirementsHash}"`);

  const seen = new Set<LocatorHash>();
  const makeTreeNode = (request: PeerRequestNode): treeUtils.TreeNode => {
    if (seen.has(request.requester.locatorHash)) {
      return {
        value: formatUtils.tuple(formatUtils.Type.DEPENDENT, {locator: request.requester, descriptor: request.descriptor}),
        children: request.children.size > 0
          ? [{value: formatUtils.tuple(formatUtils.Type.NO_HINT, `...`)}]
          : [],
      };
    }

    seen.add(request.requester.locatorHash);
    return {
      value: formatUtils.tuple(formatUtils.Type.DEPENDENT, {locator: request.requester, descriptor: request.descriptor}),
      children: Object.fromEntries(
        Array.from(request.children.values(), child => {
          return [
            structUtils.stringifyLocator(child.requester),
            makeTreeNode(child),
          ];
        }),
      ),
    };
  };

  const warning = project.peerWarnings.find(warning => {
    return warning.hash === peerRequirementsHash;
  });

  const report = await StreamReport.start({
    configuration: project.configuration,
    stdout: opts.stdout,
    includeFooter: false,
    includePrefix: false,
  }, async report => {
    const Marks = formatUtils.mark(project.configuration);
    const mark = warning ? Marks.Cross : Marks.Check;

    report.reportInfo(MessageName.UNNAMED, `Package ${
      formatUtils.pretty(project.configuration, root.subject, formatUtils.Type.LOCATOR)
    } is requested to provide ${
      formatUtils.pretty(project.configuration, root.ident, formatUtils.Type.IDENT)
    } by its descendants`);

    report.reportSeparator();

    report.reportInfo(MessageName.UNNAMED, formatUtils.pretty(project.configuration, root.subject, formatUtils.Type.LOCATOR));
    treeUtils.emitTree({
      children: Object.fromEntries(
        Array.from(root.requests.values(), request => {
          return [
            structUtils.stringifyLocator(request.requester),
            makeTreeNode(request),
          ];
        }),
      ),
    }, {
      configuration: project.configuration,
      stdout: opts.stdout,
      json: false,
    });

    report.reportSeparator();

    if (root.provided.range === `missing:`) {
      const problem = warning ? `` : ` , but all peer requests are optional`;

      report.reportInfo(MessageName.UNNAMED, `${mark} Package ${
        formatUtils.pretty(project.configuration, root.subject, formatUtils.Type.LOCATOR)
      } does not provide ${
        formatUtils.pretty(project.configuration, root.ident, formatUtils.Type.IDENT)
      }${problem}.`);
    } else {
      const providedLocatorHash = project.storedResolutions.get(root.provided.descriptorHash);
      if (!providedLocatorHash)
        throw new Error(`Assertion failed: Expected the descriptor to be registered`);

      const providedPackage = project.storedPackages.get(providedLocatorHash);
      if (!providedPackage)
        throw new Error(`Assertion failed: Expected the package to be registered`);

      report.reportInfo(MessageName.UNNAMED, `${mark} Package ${
        formatUtils.pretty(project.configuration, root.subject, formatUtils.Type.LOCATOR)
      } provides ${
        formatUtils.pretty(project.configuration, root.ident, formatUtils.Type.IDENT)
      } with version ${
        structUtils.prettyReference(project.configuration, providedPackage.version ?? `0.0.0`)
      }, ${warning ? `which does not satisfy all requests.` : `which satisfies all requests`}`);

      if (warning?.type === PeerWarningType.NodeNotCompatible) {
        if (warning.range) {
          report.reportInfo(MessageName.UNNAMED, `  The combined requested range is ${formatUtils.pretty(project.configuration, warning.range, formatUtils.Type.RANGE)}`);
        } else {
          report.reportInfo(MessageName.UNNAMED, `  Unfortunately, the requested ranges have no overlap`);
        }
      }
    }
  });


  return report.exitCode();
}

export async function explainPeerRequirements(project: Project, opts: {stdout: Writable}) {
  const report = await StreamReport.start({
    configuration: project.configuration,
    stdout: opts.stdout,
    includeFooter: false,
    includePrefix: false,
  }, async report => {
    const Marks = formatUtils.mark(project.configuration);

    const sorted = miscUtils.sortMap(project.peerRequirementNodes, [
      ([, requirement]) => structUtils.stringifyLocator(requirement.subject),
      ([, requirement]) => structUtils.stringifyIdent(requirement.ident),
    ]);

    for (const [,peerRequirement] of sorted.values()) {
      if (!peerRequirement.root)
        continue;

      const warning = project.peerWarnings.find(warning => {
        return warning.hash === peerRequirement.hash;
      });

      const allRequests = [...structUtils.allPeerRequests(peerRequirement)];
      let andOthers;
      if (allRequests.length > 2)
        andOthers = ` and ${allRequests.length - 1} other dependencies`;
      else if (allRequests.length === 2)
        andOthers = ` and 1 other dependency`;
      else
        andOthers = ``;

      if (peerRequirement.provided.range !== `missing:`) {
        const providedResolution = project.storedResolutions.get(peerRequirement.provided.descriptorHash);
        if (!providedResolution)
          throw new Error(`Assertion failed: Expected the resolution to have been registered`);

        const providedPkg = project.storedPackages.get(providedResolution);
        if (!providedPkg)
          throw new Error(`Assertion failed: Expected the provided package to have been registered`);

        const message = `${
          formatUtils.pretty(project.configuration, peerRequirement.hash, formatUtils.Type.CODE)
        } → ${
          warning ? Marks.Cross : Marks.Check
        } ${
          structUtils.prettyLocator(project.configuration, peerRequirement.subject)
        } provides ${
          structUtils.prettyLocator(project.configuration, providedPkg)
        } to ${
          structUtils.prettyLocator(project.configuration, allRequests[0]!.requester)
        }${andOthers}`;

        if (warning) {
          report.reportWarning(MessageName.UNNAMED, message);
        } else {
          report.reportInfo(MessageName.UNNAMED, message);
        }
      } else {
        const message = `${
          formatUtils.pretty(project.configuration, peerRequirement.hash, formatUtils.Type.CODE)
        } → ${
          warning ? Marks.Cross : Marks.Check
        } ${
          structUtils.prettyLocator(project.configuration, peerRequirement.subject)
        } doesn't provide ${
          structUtils.prettyIdent(project.configuration, peerRequirement.ident)
        } to ${
          structUtils.prettyLocator(project.configuration, allRequests[0]!.requester)
        }${andOthers}`;

        if (warning) {
          report.reportWarning(MessageName.UNNAMED, message);
        } else {
          report.reportInfo(MessageName.UNNAMED, message);
        }
      }
    }
  });


  return report.exitCode();
}
