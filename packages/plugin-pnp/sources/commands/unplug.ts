import {Configuration, Locator, Plugin, Project} from '@berry/core';
import {miscUtils, structUtils}                  from '@berry/core';
import {Writable}                                from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`unplug [... packages] [--reset]`)
  .describe(`configure packages to be unplugged when installed`)

  .action(async ({cwd, stdout, packages, reset, ... env}: {cwd: string, stdout: Writable, packages: Array<string>, reset: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);

    const formatLocator = (locator: Locator) => {
      if (!locator.reference) {
        return structUtils.stringifyIdent(locator);
      } else {
        return structUtils.stringifyLocator(locator);
      }
    };

    const stringifiedLocators = packages.map(raw => {
      return formatLocator(structUtils.parseLocator(raw, false));
    });

    const pnpUnpluggedPackages = new Set([
      ... configuration.pnpUnpluggedPackages.map((locator: Locator) => {
        return formatLocator(locator);
      }),
    ]);

    if (reset) {
      if (stringifiedLocators.length > 0) {
        for (const stringified of stringifiedLocators) {
          pnpUnpluggedPackages.delete(stringified);
        }
      } else {
        pnpUnpluggedPackages.clear();
      }
    } else {
      for (const stringified of stringifiedLocators) {
        pnpUnpluggedPackages.add(stringified);
      }
    }
    
    const sortedPackages = miscUtils.sortMap(pnpUnpluggedPackages, stringified => {
      return stringified;
    });

    await Configuration.updateConfiguration(project.cwd, {
      pnpUnpluggedPackages: sortedPackages.length > 0
        ? sortedPackages
        : undefined,
    });

    return concierge.run(null, [`install`], {cwd, stdout, plugins, ... env});
  });
