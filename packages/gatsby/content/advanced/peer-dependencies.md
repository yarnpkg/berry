---
category: advanced
path: /advanced/peer-dependencies
title: "Peer Dependencies"
---

The PnP linker guarantees that each combination of package name / version will only be instantiated once, except in one documented case: if a package has peer dependencies. Such ones will be instantiated once *for each time a hard dependency is found in the dependency tree*.

For example, let's say you have `react` and `react-dom`. Since the `react` package doesn't list any peer dependencies, a same version of `react` will only ever be instantiated once regardless how many dependent packages list it in their `dependencies` field. However, because `react-dom` lists `react` within its `peerDependencies` field, Yarn will need to install it in such a way that it will be instantiated exactly once for each package that list it in their `dependencies` field.

## Why does it work this way?

Let's say you have `package-a` and `package-b`. Both of them depend on the same package `child`, which has a peer dependency on `peer`. Now, imagine that `package-a` depends on `peer@1` while `package-b` depends on `peer@2`. In this instance, in order to respect the peer dependency requirement, `child` will have to be instantiated - it wouldn't be possible otherwise for `child` to simultaneously use both `package-a` and `package-b`.

In order to make sure that `child` will get instantiated twice, we generate what we call "virtual packages". A virtual packages simply is an additional instance of a package, that points to the same location on the disk but will have its own in-memory representation. In order to generate those virtual packages, we need them to give each of them a unique identifier. Now, what information could we use to do this?

The first thing you might think of could be something along those lines: "the unique identifier for a virtual package must be based on its set of inherited dependencies". So in our example, since `child` has two sets of inherited dependencies, it would get two unique identifiers, would be instantiated twice, and everything would work. Additionally, if `package-a` and `package-b` happened to depend on the same version of `peer` then we would only generate one virtual package, which would decrease the tree complexity. Unfortunately, it's not so simple.

Problems arise when you consider circular dependencies. Let's imagine a different scenario: `package` depends on `child-a` and `child-b`. The `child-a` package has a peer dependency on `child-b`, and `child-b` has a peer dependency on `child-a`. In this situation, per the wording described above, we would need to generate the unique identifier for `child-a` based on the set of its dependencies, which includes `child-b`. But since the unique identifier for `child-b` depends on the one from `child-a`, we cannot do that! The loop cannot be broken this way.

The solution to this issue is to say that the unique identifier for a package with peer dependencies is based on the unique identifier of its *direct parent*. Since a package unique identifier is always computed before its children (which also happens to be the reason why peer dependencies must be explicitly listed at every level of the dependency hierarchy), we cannot have a cyclic dependency.

## How to prevent multiple instantiation?

In some cases you really don't want a package to be instantiated twice. It can be because you're using `instanceof` on user-provided objects (which would break for similar objects from different instances), or because your code has side effects (for example by having a singleton).

In general we simply discourage the use of these patterns. They are quite dangerous, and it's hard to know for sure whether your package will really be instantiated once (while Yarn can make such guarantees, other package managers might not). Still, it might also be difficult to change immediatly, so you have a few tools at your disposal:

- You can move the code managing your singleton inside its own package. So for example in the case of `relay-runtime` (which has a singleton and a peer dependency on `relay-compiler`) one solution would to move the singleton into a dedicated package that wouldn't have any peer dependency. Since Yarn guarantees that a single package name / version is always instantiated once in such cases, your singleton would be safe.

- Maybe simpler, your singleton can also be stored within the global context, using an identifier unique to your application. This might actually be even safer than what you currently do, because you'd then be able to properly check for multiple conflicting versions being used:

  ```
  const myVersion = require('./package.json').version;

  function makeSingleton() {
      return {
        value: new Something(),
        version: myVersion,
      };
  }

  export function getSingleton() {
      // Note that symbols cannot be used, as each package instance would have
      // a different symbol instance
      if (!global.singleton)
        global.singleton = makeSingleton();

      const {value, version} = global.singleton;
      console.assert(version === myVersion);

      return value;
  }
  ```
