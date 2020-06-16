import {Cache, Configuration, Project, ThrowReport, structUtils, LocatorHash, Package} from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs}                                            from '@yarnpkg/fslib';
import LinkPlugin                                                                      from '@yarnpkg/plugin-link';
import PnpPlugin                                                                       from '@yarnpkg/plugin-pnp';

const getConfiguration = (p: PortablePath) => {
  return Configuration.create(p, p, new Map([
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

  it(`should generate the exact same structure with a full resolveEverything as hydrateVirtualPackages`, async () => {
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

      let project1: Project;
      let project2: Project;

      // First we install the project; this will generate the lockfile yada yada
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);
        const cache = await Cache.find(configuration);

        await project.install({cache, report: new ThrowReport()});

        project1 = project;
      }

      // Then we setup the project except that this time we only call `hydrateVirtualPackages`
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        await project.restoreInstallState();

        project2 = project;
      }

      // We remove the "version" field from all pkgs, because they contain
      // invalid data when calling the resolution through the lockfileOnly
      // mode (which is what hydrateVirtualPackage does, in part).
      //
      // This discrepancy is expected, because we don't want to store the real
      // version number inside the lockfile for developer experience purposes
      // (otherwise our users would need to run `yarn install` again each time
      // they change the version from one of their workspaces / portals).
      const clean = (registry: Map<LocatorHash, Package>) => {
        return new Map([...registry.values()].map(pkg => {
          return [pkg.locatorHash, {...pkg, version: null}];
        }));
      };

      expect({
        packages: clean(project1.storedPackages),
        descriptors: project1.storedDescriptors,
        resolutions: project1.storedResolutions,
      }).toEqual({
        packages: clean(project2.storedPackages),
        descriptors: project2.storedDescriptors,
        resolutions: project2.storedResolutions,
      });
    });
  });
});
