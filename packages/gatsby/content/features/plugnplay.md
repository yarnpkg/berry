---
category: features
path: /features/pnp
title: "Plug'n'Play"
---

Plug'n'Play is an alternative installation strategy unveiled in September 2018. It presents interesting characteristics that make suitable for a large panel of projects, and is designed for compatibility with the current ecosystem.

The way regular installs work is simple: Yarn generates a `node_modules` directory that Node is then able to consume. In this context, Node doesn't know the first thing about what a package is: it only reasons in terms of files. "Does this file exist here? No? Let's look in the parent `node_modules` then. Does it exist here? Still no? Too bad... parent folder it is!" - and it does this until it finds something that matches one of the possibilities. That's vastly inefficient.

When you think about it, Yarn knows everything about your dependency tree - it evens installs it! So why is Node tasked with locating your packages on the disk? Why don't we simply query Yarn, and let it tell us where to look for a package X required by a package Y? That's what Plug'n'Play (abbreviated PnP) is. Instead of generating a `node_modules` directory and leaving the resolution to Node, we now generate a single `.pnp.js` file and let Yarn tell us where to find our packages. Doing this provides a lot of benefits:

- The `node_modules` directories typically contain gargantuan amounts of files. Generating them can make up for more than 70% of the time needed to run `yarn install` - **even with a hot cache**. Because the copy is I/O bound, it's not like package managers can really optimize it either - we can use hardlinks or copy-on-write, but even then we still need to make a bunch of syscalls that slow us down dramatically.

- Because Node has no concept of "package", it doesn't know whether a file is _meant_ to be accessed, rather than simply being available. It's entirely possible that the code you wrote will work in development but break in production because you forgot to list one of your dependencies in your `package.json`, but it kept working because the package was hoisted and made available thanks to one of your development dependencies.

- Even at runtime, the Node resolution needs to make a bunch of `stat` and `readdir` calls in order to figure out from where to load every single package loaded. It's extremely wasteful, and is part of the reason why booting a Node application takes so much time - before even starting executing it, Node has to spend its time querying the filesystem for information that Yarn could have given it already.

- Finally, the very design of the `node_modules` folder is impractical in that it doesn't allow to dedupe packages as efficiently as one would hope. Because two packages with the same name but different versions cannot coexist in the same directory, we can't guarantee a perfect hoisting. Similarly, because the `node_modules` are deeply nested in a way that depend on the project dependencies, they cannot be shared from one project to the other.

All those problems and more are solved by Plug'n'Play.
