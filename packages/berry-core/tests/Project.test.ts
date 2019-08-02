import {Cache, Configuration, Project, ThrowReport, structUtils} from '@berry/core';
import {Filename, PortablePath, ppath, xfs}                      from '@berry/fslib';
import LinkPlugin                                                from '@berry/plugin-link';
import PnpPlugin                                                 from '@berry/plugin-pnp';

const getConfiguration = (p: PortablePath) => {
  return new Configuration(p, p, new Map([
    [`@berry/plugin-link`, LinkPlugin],
    [`@berry/plugin-pnp`, PnpPlugin],
  ]));
};

describe(`Project`, () => {
  it(`should resolve the virtual links at instantiation`, async () => {
    await xfs.mktempPromise(async dir => {
      await xfs.mkdirpPromise(ppath.join(dir, `foo` as Filename));
      await xfs.writeFilePromise(ppath.join(dir, `foo` as Filename, `package.json` as Filename), JSON.stringify({
        name: `foo`,
        peerDependencies: {
          [`bar`]: `*`,
        },
      }, null, 2));

      await xfs.mkdirpPromise(ppath.join(dir, `bar` as PortablePath));
      await xfs.writeFilePromise(ppath.join(dir, `bar` as Filename, `package.json` as Filename), JSON.stringify({
        name: `bar`,
      }, null, 2));

      await xfs.writeFilePromise(ppath.join(dir, `package.json` as Filename), JSON.stringify({
        dependencies: {
          [`foo`]: `portal:./foo`,
          [`bar`]: `portal:./bar`,
        },
      }));

      // First we install the project; this will generate the lockfile yada yada
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);
        const cache = await Cache.find(configuration);

        await project.install({cache, report: new ThrowReport()});
      }

      // Then we do it again; if the virtual resolution succeeded, then the `foo` package should have a dependency on `bar`
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        const topLevelPkg = project.storedPackages.get(project.topLevelWorkspace.anchoredLocator.locatorHash);

        const fooIdent = structUtils.makeIdent(null, `foo`);
        const barIdent = structUtils.makeIdent(null, `bar`);

        const fooDescriptor = topLevelPkg.dependencies.get(fooIdent.identHash);
        const fooResolution = project.storedResolutions.get(fooDescriptor.descriptorHash);
        const fooPkg = project.storedPackages.get(fooResolution);

        expect(structUtils.isVirtualLocator(fooPkg)).toEqual(true);
        expect(fooPkg.dependencies.has(barIdent.identHash)).toEqual(true);
      }
    });
  });
});
