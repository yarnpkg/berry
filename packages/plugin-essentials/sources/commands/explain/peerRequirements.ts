import {BaseCommand}                                                                                             from '@yarnpkg/cli';
import type {PeerRequestNode}                                                                                    from '@yarnpkg/core/sources/Project';
import {Configuration, MessageName, Project, StreamReport, structUtils, formatUtils, treeUtils, PeerWarningType} from '@yarnpkg/core';
import {Command, Option}                                                                                         from 'clipanion';
import {Writable}                                                                                                from 'stream';
import * as t                                                                                                    from 'typanion';

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

    return await explainPeerRequirement(this.hash, project, {
      stdout: this.context.stdout,
    });
  }
}

export async function explainPeerRequirement(peerRequirementsHash: string, project: Project, opts: {stdout: Writable}) {
  const root = project.peerRequirementNodes.get(peerRequirementsHash);
  if (typeof root === `undefined`)
    throw new Error(`No peerDependency requirements found for hash: "${peerRequirementsHash}"`);

  const makeTreeNode = (request: PeerRequestNode): treeUtils.TreeNode => {
    return {
      value: formatUtils.tuple(formatUtils.Type.DEPENDENT, {locator: request.requester, descriptor: request.descriptor}),
      children: Object.fromEntries(
        Array.from(request.children.values(), child => {
          return [
            structUtils.stringifyLocator(child.requester),
            child ? makeTreeNode(child) : false,
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
