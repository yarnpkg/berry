import {BaseCommand, WorkspaceRequiredError}                   from '@berry/cli';
import {AllDependencies, Configuration, IdentHash, Manifest}   from '@berry/core';
import {MessageName, Project, StreamReport, WorkspaceResolver} from '@berry/core';
import {Workspace, structUtils}                                from '@berry/core';
import {Command, UsageError}                                   from 'clipanion';
import semver                                                  from 'semver';

// Basically we only support auto-upgrading the ranges that are very simple (^x.y.z, ~x.y.z, >=x.y.z, and of course x.y.z)
const SUPPORTED_UPGRADE_REGEXP = /^(>=|[~^]|)^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;

// eslint-disable-next-line arca/no-default-export
export default class VersionApplyCommand extends BaseCommand {
  @Command.Boolean(`--all`)
  all: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.Boolean(`--dependents`)
  dependents: boolean = false;

  static usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply all the deferred version bumps at once`,
    details: `
      This command will apply the deferred version changes (scheduled via \`yarn version major|minor|patch\`) on the current workspace (or all of them if \`--all\`) is specified.

      It will also update the \`workspace:\` references across all your local workspaces so that they keep refering to the same workspace even after the version bump.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `Apply the version change to the local workspace`,
      `yarn version apply`,
    ], [
      `Apply the version change to all the workspaces in the local workspace`,
      `yarn version apply --all`,
    ]],
  });

  @Command.Path(`version`, `apply`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const applyReport = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const allDependents: Map<Workspace, Array<[
        Workspace,
        AllDependencies,
        IdentHash,
      ]>> = new Map();

      // First we compute the reverse map to figure out which workspace is
      // depended upon by which other.
      //
      // Note that we need to do this before applying the new versions,
      // otherwise the `findWorkspacesByDescriptor` calls won't be able to
      // resolve the workspaces anymore (because the workspace versions will
      // have changed and won't match the outdated dependencies).

      for (const dependent of project.workspaces) {
        for (const set of Manifest.allDependencies) {
          for (const descriptor of dependent.manifest[set].values()) {
            const workspaces = project.findWorkspacesByDescriptor(descriptor);
            if (workspaces.length !== 1)
              continue;

            // When operating on a single workspace, we don't have to compute
            // the dependencies for the other ones
            const dependency = workspaces[0];
            if (!this.all && dependency !== workspace)
              continue;

            let dependents = allDependents.get(dependency);
            if (typeof dependents === `undefined`)
              allDependents.set(dependency, dependents = []);

            dependents.push([dependent, set, descriptor.identHash]);
          }
        }
      }

      // First a quick sanity check before we start modifying stuff

      const validateWorkspace = (workspace: Workspace) => {
        const nextVersion = workspace.manifest.raw.nextVersion;
        if (typeof nextVersion === `undefined`)
          return;
        if (typeof nextVersion !== `object` || nextVersion === null)
          throw new Error(`Assertion failed: The nextVersion field should have been an object`);

        const newVersion = workspace.manifest.raw.nextVersion.semver;
        if (typeof newVersion === `undefined`)
          return;
        if (typeof newVersion !== `string`)
          throw new Error(`Assertion failed: The nextVersion.semver should have been a string`);

        if (!semver.valid(newVersion)) {
          throw new UsageError(`Can't apply the version bump if the resulting version (${newVersion}) isn't valid semver`);
        }
      };

      if (!this.all) {
        validateWorkspace(workspace);
      } else {
        for (const workspace of project.workspaces) {
          validateWorkspace(workspace);
        }
      }

      // Now that we know which workspaces depend on which others, we can
      // proceed to update everything at once using our accumulated knowledge.

      const processWorkspace = (workspace: Workspace) => {
        const nextVersion = workspace.manifest.raw.nextVersion;
        if (typeof nextVersion === `undefined`)
          return;
        if (typeof nextVersion !== `object` || nextVersion === null)
          throw new Error(`Assertion failed: The nextVersion field should have been an object`);

        const newVersion = workspace.manifest.raw.nextVersion.semver;
        if (typeof newVersion === `undefined`)
          return;
        if (typeof newVersion !== `string`)
          throw new Error(`Assertion failed: The nextVersion.semver should have been a string`);

        const oldVersion = workspace.manifest.version;
        workspace.manifest.version = newVersion;
        workspace.manifest.raw.nextVersion = undefined;

        const identString = workspace.manifest.name !== null
          ? structUtils.stringifyIdent(workspace.manifest.name)
          : null;

        report.reportInfo(MessageName.UNNAMED, `${structUtils.prettyLocator(configuration, workspace.anchoredLocator)}: Bumped to ${newVersion}`);
        report.reportJson({cwd: workspace.cwd, ident: identString, oldVersion, newVersion});

        const dependents = allDependents.get(workspace);
        if (typeof dependents === `undefined`)
          return;

        for (const [dependent, set, identHash] of dependents) {
          const descriptor = dependent.manifest[set].get(identHash);
          if (typeof descriptor === `undefined`)
            throw new Error(`Assertion failed: The dependency should have existed`);

          let range = descriptor.range;
          let useWorkspaceProtocol = false;

          if (range.startsWith(WorkspaceResolver.protocol)) {
            range = range.slice(WorkspaceResolver.protocol.length);
            useWorkspaceProtocol = true;

            // Workspaces referenced through their path never get upgraded ("workspace:packages/berry-core")
            if (range === workspace.relativeCwd) {
              continue;
            }
          }

          // We can only auto-upgrade the basic semver ranges (we can't auto-upgrade ">=1.0.0 <2.0.0", for example)
          const parsed = range.match(SUPPORTED_UPGRADE_REGEXP);
          if (!parsed) {
            report.reportWarning(MessageName.UNNAMED, `Couldn't auto-upgrade range ${range} (in ${structUtils.prettyLocator(configuration, workspace.anchoredLocator)})`);
            continue;
          }

          let newRange = `${parsed[1]}${newVersion}`;
          if (useWorkspaceProtocol)
            newRange = `${WorkspaceResolver.protocol}${newRange}`;

          const newDescriptor = structUtils.makeDescriptor(descriptor, newRange);
          dependent.manifest[set].set(identHash, newDescriptor);
        }
      };

      if (!this.all) {
        processWorkspace(workspace);
      } else {
        for (const workspace of project.workspaces) {
          processWorkspace(workspace);
        }
      }

      await project.persist();
    });

    return applyReport.exitCode();
  }
}
