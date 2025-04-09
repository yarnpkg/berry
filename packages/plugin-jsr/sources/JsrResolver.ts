import {Locator, MinimalResolveOptions, Package, ResolveOptions, Resolver}                     from '@yarnpkg/core';
import {Descriptor}                                                                            from '@yarnpkg/core';

import {JSR_PROTOCOL}                                                                          from './constants';
import {convertDescriptorFromJsrToNpm, convertLocatorFromJsrToNpm, convertLocatorFromNpmToJsr} from './helpers';

export class JsrResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(JSR_PROTOCOL))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(JSR_PROTOCOL))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    const nextLocator = convertLocatorFromJsrToNpm(locator);

    return opts.resolver.shouldPersistResolution(nextLocator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    // This is a hack. Let me explain:
    //
    // Imagine we run `yarn add foo@jsr:^1.0.0`. We want to have `"foo": "jsr:1.2.3"` in our lockfile. For
    // that to happen, suggestUtils need our resolver to return "foo@jsr:1.2.3" as locator; if we were to
    // return "foo@npm:@jsr/foo@1.2.3" instead, then it'd be unable to store it as-is (unless we hardcoded
    // this behavior).
    //
    // However, if we return "foo@jsr:1.2.3", then we need to also have a fetcher. Since we don't want to
    // recode the whole fetcher, we just convert our jsr locator into a npm one and recursively call the
    // fetcher. This works, but with a caveat: since we are "publicly" resolving to foo@jsr:1.2.3 locator
    // rather than foo@npm:@jsr/foo@1.2.3, then foo@npm:@jsr/foo@1.2.3 will not be in the lockfile. And it's
    // in the lockfile that we keep the checksums, so there would be no checksum registration for this package.
    //
    // To avoid this, we register a resolution dependency on the converted npm descriptor. This forces it
    // to be present in the lockfile.
    //
    // It's not ideal because nothing guarantees that foo@jsr:^1.0.0 will be locked to the same version as
    // foo@npm:@jsr/foo@1.2.3 (I think it should be the case except if the user manually modifies the
    // lockfile), but it's the best I can think of for now (I think we'll be able to fix this in the next
    // major redesign).
    //
    // It's almost like we'd need to have locator dependencies.
    //
    return {inner: convertDescriptorFromJsrToNpm(descriptor)};
  }

  async getCandidates(descriptor: Descriptor, dependencies: Record<string, Package>, opts: ResolveOptions) {
    const nextDescriptor = opts.project.configuration.normalizeDependency(convertDescriptorFromJsrToNpm(descriptor));
    const candidates = await opts.resolver.getCandidates(nextDescriptor, dependencies, opts);

    return candidates.map(candidate => {
      return convertLocatorFromNpmToJsr(candidate);
    });
  }

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const nextDescriptor = opts.project.configuration.normalizeDependency(convertDescriptorFromJsrToNpm(descriptor));

    return opts.resolver.getSatisfying(nextDescriptor, dependencies, locators, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const nextLocator = convertLocatorFromJsrToNpm(locator);
    const resolved = await opts.resolver.resolve(nextLocator, opts);

    return {...resolved, ...convertLocatorFromNpmToJsr(resolved)};
  }
}
