import {Cache, Configuration, Project, ThrowReport, structUtils} from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs}                      from '@yarnpkg/fslib';
import LinkPlugin                                                from '@yarnpkg/plugin-link';
import PnpPlugin                                                 from '@yarnpkg/plugin-pnp';

const getConfiguration = (p: PortablePath) => {
  return new Configuration(p, p, new Map([
    [`@yarnpkg/plugin-link`, LinkPlugin],
    [`@yarnpkg/plugin-pnp`, PnpPlugin],
  ]));
};

describe(`Project`, () => {
  it(`should resolve virtual links during 'resolveEverything'`, async () => {
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

        await project.resolveEverything({
          lockfileOnly: true,
          report: new ThrowReport(),
        });

        const topLevelPkg = project.storedPackages.get(project.topLevelWorkspace.anchoredLocator.locatorHash)!;

        const fooIdent = structUtils.makeIdent(null, `foo`);
        const barIdent = structUtils.makeIdent(null, `bar`);

        const fooDescriptor = topLevelPkg.dependencies.get(fooIdent.identHash)!;
        const fooResolution = project.storedResolutions.get(fooDescriptor.descriptorHash)!;
        const fooPkg = project.storedPackages.get(fooResolution)!;

        expect(structUtils.isVirtualLocator(fooPkg)).toEqual(true);
        expect(fooPkg.dependencies.has(barIdent.identHash)).toEqual(true);
      }
    });
  });
});
