import {xfs, ppath}                                      from '@yarnpkg/fslib';
import {parseSyml}                                       from '@yarnpkg/parsers';

import {MessageName}                                     from './MessageName';
import {Project}                                         from './Project';
import {Report}                                          from './Report';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as semverUtils                                  from './semverUtils';
import * as structUtils                                  from './structUtils';
import {DescriptorHash, Descriptor, Locator, Package}    from './types';

export const IMPORTED_PATTERNS: Array<[RegExp, (version: string, ...args: Array<string>) => string]> = [
  // These ones come from Git urls
  [/^(git(?:\+(?:https|ssh))?:\/\/.*(?:\.git)?)#(.*)$/, (version, $0, $1, $2) => `${$1}#commit=${$2}`],

  // These ones come from the GitHub HTTP endpoints
  [/^https:\/\/((?:[^/]+?)@)?codeload\.github\.com\/([^/]+\/[^/]+)\/tar\.gz\/([0-9a-f]+)$/, (version, $0, $1 = ``, $2, $3) => `https://${$1}github.com/${$2}.git#commit=${$3}`],
  [/^https:\/\/((?:[^/]+?)@)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?#([0-9a-f]+)$/, (version, $0, $1 = ``, $2, $3) => `https://${$1}github.com/${$2}.git#commit=${$3}`],

  // These ones come from the npm registry
  // Note: /download/ is used by custom registries like Taobao
  [/^https?:\/\/[^/]+\/(?:[^/]+\/)*(?:@.+(?:\/|(?:%2f)))?([^/]+)\/(?:-|download)\/\1-[^/]+\.tgz(?:#|$)/, version => `npm:${version}`],
  // The GitHub package registry uses a different style of URLs
  [/^https:\/\/npm\.pkg\.github\.com\/download\/(?:@[^/]+)\/(?:[^/]+)\/(?:[^/]+)\/(?:[0-9a-f]+)(?:#|$)/, version => `npm:${version}`],
  // FontAwesome too; what is it with these registries that made them think using a different url pattern was a good idea?
  [/^https:\/\/npm\.fontawesome\.com\/(?:@[^/]+)\/([^/]+)\/-\/([^/]+)\/\1-\2.tgz(?:#|$)/, version => `npm:${version}`],
  // JFrog
  [/^https?:\/\/(?:[^\\.]+)\.jfrog\.io\/.*\/(@[^/]+)\/([^/]+)\/-\/\1\/\2-(?:[.\d\w-]+)\.tgz(?:#|$)/, (version, $0) => structUtils.makeRange({protocol: `npm:`, source: null, selector: version, params: {__archiveUrl: $0}})],

  // These ones come from the old Yarn offline mirror - we assume they came from npm
  [/^[^/]+\.tgz#[0-9a-f]+$/, version => `npm:${version}`],
];

export class LegacyMigrationResolver implements Resolver {
  private resolutions: Map<DescriptorHash, Locator> | null = null;

  constructor(private readonly resolver: Resolver) { }

  async setup(project: Project, {report}: {report: Report}) {
    const lockfilePath = ppath.join(project.cwd, project.configuration.get(`lockfileFilename`));

    // No need to enable it if the lockfile doesn't exist
    if (!xfs.existsSync(lockfilePath))
      return;

    const content = await xfs.readFilePromise(lockfilePath, `utf8`);
    const parsed = parseSyml(content);

    // No need to enable it either if the lockfile is modern
    if (Object.prototype.hasOwnProperty.call(parsed, `__metadata`))
      return;

    const resolutions = this.resolutions = new Map();

    for (const key of Object.keys(parsed)) {
      let descriptor = structUtils.tryParseDescriptor(key);

      if (!descriptor) {
        report.reportWarning(MessageName.YARN_IMPORT_FAILED, `Failed to parse the string "${key}" into a proper descriptor`);
        continue;
      }

      if (semverUtils.validRange(descriptor.range))
        descriptor = structUtils.makeDescriptor(descriptor, `npm:${descriptor.range}`);

      const {version, resolved} = (parsed as any)[key];

      // Workspaces don't have the "resolved" key; we can skip them, as their
      // resolution will be recomputed when needed anyway
      if (!resolved)
        continue;

      let reference;

      for (const [pattern, matcher] of IMPORTED_PATTERNS) {
        const match = resolved.match(pattern);

        if (match) {
          reference = matcher(version, ...match);
          break;
        }
      }

      if (!reference) {
        report.reportWarning(MessageName.YARN_IMPORT_FAILED, `${structUtils.prettyDescriptor(project.configuration, descriptor)}: Only some patterns can be imported from legacy lockfiles (not "${resolved}")`);
        continue;
      }

      // If the range is a valid descriptor we're dealing with an alias ("foo": "npm:lodash@*")
      // and need to make the locator from that instead of the original descriptor
      let actualDescriptor = descriptor;
      try {
        const parsedRange = structUtils.parseRange(descriptor.range);
        const potentialDescriptor = structUtils.tryParseDescriptor(parsedRange.selector, true);
        if (potentialDescriptor) {
          actualDescriptor = potentialDescriptor;
        }
      } catch { }

      resolutions.set(descriptor.descriptorHash, structUtils.makeLocator(actualDescriptor, reference));
    }
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!this.resolutions)
      return false;

    return this.resolutions.has(descriptor.descriptorHash);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    // This resolver only supports the descriptor -> locator part of the
    // resolution, not the locator -> package one.
    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): never {
    throw new Error(`Assertion failed: This resolver doesn't support resolving locators to packages`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    if (!this.resolutions)
      throw new Error(`Assertion failed: The resolution store should have been setup`);

    const resolution = this.resolutions.get(descriptor.descriptorHash);
    if (!resolution)
      throw new Error(`Assertion failed: The resolution should have been registered`);

    return await this.resolver.getCandidates(structUtils.convertLocatorToDescriptor(resolution), dependencies, opts);
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    throw new Error(`Assertion failed: This resolver doesn't support resolving locators to packages`);
  }
}
