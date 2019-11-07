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

const createPackage = async (dir, packageName, manifest: { workspaces?: {}, [key: string]: any } = {}) => {
  await xfs.mkdirpPromise(ppath.join(dir, packageName as Filename));
  await xfs.writeFilePromise(ppath.join(dir, packageName as Filename, `package.json` as Filename), JSON.stringify({
    private: !!manifest.workspaces,
    name: packageName,
    ...manifest,
  }, null, 2));
};

const installProject = async (dir) => {
  const configuration = await getConfiguration(dir);
  const {project} = await Project.find(configuration, dir);
  const cache = await Cache.find(configuration);

  await project.install({cache, report: new ThrowReport()});
};

describe(`Project`, () => {
  it(`should resolve the virtual links at instantiation`, async () => {
    await xfs.mktempPromise(async dir => {
      await createPackage(dir, 'foo', {peerDependencies: {bar: `*`}});
      await createPackage(dir, 'bar');
      await createPackage(dir, '', {dependencies: {
        foo: `portal:./foo`,
        bar: `portal:./bar`,
      }});

      // First we install the project; this will generate the lockfile yada yada
      await installProject(dir);

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

  it(`should consolidate the virtual links at instantiation`, async () => {
    await xfs.mktempPromise(async dir => {
      const packagesDir = ppath.join(dir, 'packages' as Filename);
      // The packages are setup so that d becomes a virtual package. Then d is included in
      // a, b, and c as standard dependency causing the system to create 3 different virtual packages
      // which are then consolidated back to one since the peer dependencies align
      await createPackage(packagesDir, 'a', {version: "1.0.0", dependencies: {b: '^1.0.0', c: '^1.0.0', d: '^1.0.0', e: '^1.0.0'}});
      await createPackage(packagesDir, 'b', {version: "1.0.0", dependencies: {d: '^1.0.0'}, devDependencies: {e: '^1.0.0'}});
      await createPackage(packagesDir, 'c', {version: "1.0.0", dependencies: {d: '^1.0.0'}, devDependencies: {e: '^1.0.0'}});
      await createPackage(packagesDir, 'd', {version: "1.0.0", peerDependencies: {e: `*`}, devDependencies: {e: '^1.0.0'}});
      await createPackage(packagesDir, 'e', {version: "1.0.0"});
      await createPackage(dir, '', {workspaces: ['packages/*']});

      // First we install the project; this will generate the lockfile yada yada
      await installProject(dir);

      // Then we do it again; if the virtual resolution succeeded, then the `foo` package should have a dependency on `bar`
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        const workspaceA = project.workspaces.find(workspace => workspace.relativeCwd === 'packages/a');

        const bIdent = structUtils.makeIdent(null, `b`);
        const cIdent = structUtils.makeIdent(null, `c`);
        const dIdent = structUtils.makeIdent(null, `d`);

        const getPackage = (parentPackage, ident) => {
          const descriptor = parentPackage.dependencies.get(ident.identHash);
          const resolution = project.storedResolutions.get(descriptor.descriptorHash);
          return project.storedPackages.get(resolution);
        };

        const bPkg = getPackage(workspaceA, bIdent);
        const cPkg = getPackage(workspaceA, cIdent);

        expect(workspaceA.dependencies.get(dIdent.identHash) === bPkg.dependencies.get(dIdent.identHash)).toEqual(true);
        expect(workspaceA.dependencies.get(dIdent.identHash) === cPkg.dependencies.get(dIdent.identHash)).toEqual(true);
      }
    });
  });
});
