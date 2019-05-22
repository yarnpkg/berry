import {Workspace}  from '@berry/core';
import {UsageError} from 'clipanion';
import semver       from 'semver';

export function registerNextVersion(workspace: Workspace, level: `major` | `minor` | `patch`) {
  if (workspace.manifest.version == null)
    throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

  const version = workspace.manifest.version;
  if (typeof version !== `string` || !semver.valid(version))
    throw new UsageError(`Can't bump the version (${version}) if it's not valid semver`);

  return workspace.manifest.setRawField(`version:next`, semver.inc(version, level), {
    after: [`version`],
  });
}

export function applyNextVersion(workspace: Workspace) {
  if (!workspace.manifest.raw || !workspace.manifest.raw[`version:next`])
    return null;

  const newVersion = workspace.manifest.raw[`version:next`];
  if (typeof newVersion !== `string` || !semver.valid(newVersion))
    throw new UsageError(`Can't apply the version bump if the resulting version (${newVersion}) isn't valid semver`);

  workspace.manifest.version = newVersion;
  workspace.manifest.raw[`version:next`] = undefined;

  return newVersion;
}
