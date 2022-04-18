import {npath, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {Command, Option, runExit}        from 'clipanion';

// This file is here for compatibility reasons; running `yarn set version from sources`
// would crash when upgrading from Yarn 3 to Yarn 4 if any builtin plugins exist, because
// the files don't exist there.

runExit(class extends Command {
  pluginName = Option.String();

  async execute() {
    const identifier = `plugin-${this.pluginName}`;

    const root = ppath.dirname(npath.toPortablePath(__dirname));
    const bundleLocation = ppath.join(root, `packages/${identifier}/bundles/@yarnpkg/${identifier}.js` as PortablePath);

    await xfs.mkdirPromise(ppath.dirname(bundleLocation), {recursive: true});
    await xfs.writeFilePromise(bundleLocation, `module.exports = {name: ${JSON.stringify(`@yarnpkg/${identifier}`)}};`);

    this.context.stdout.write(`This plugin is now a builtin and can be safely removed from your configuration.\n`);
    this.context.stdout.write(`In the meantime, we'll replace it by an empty plugin; you'll need to re-import those if you decide later to go back to an older release.\n`);
  }
});
