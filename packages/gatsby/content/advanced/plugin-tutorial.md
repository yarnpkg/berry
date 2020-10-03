---
category: advanced
path: /advanced/plugin-tutorial
title: "Plugin Tutorial"
description: A basic plugin tutorial which shows how to work with Yarn's plugin API.
---

Starting from the Yarn 2, Yarn now supports plugins. For more information about what they are and in which case you'd want to use them, consult the [dedicated page](/features/plugins). We'll talk here about the exact steps needed to write one. It's quite simple, really!

```toc
# This code block gets replaced with the Table of Contents
```

## What does a plugin look like?

Plugins are scripts that get loaded at runtime by Yarn, and that can inject new behaviors into it. They also can require some packages provided by Yarn itself, such as `@yarnpkg/core`. This allows you to use the exact same core API as the Yarn binary currently in use, kinda like if it was a peer dependency!

> **Important:** Since plugins are loaded before Yarn starts (and thus before you make your first install), it's strongly advised to write your plugins in such a way that they work without dependencies. If that becomes difficult, know that we provide a powerful tool ([`@yarnpkg/builder`](#builder)) that can bundle your plugins into a single Javascript file, ready to be published.

## Writing our first plugin

Open in a text editor a new file called `plugin-hello-world.js`, and type the following code:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => ({
    // What is this `require` function, you ask? It's a `require`
    // implementation provided by Yarn core that allows you to
    // access various packages (such as @yarnpkg/core) without
    // having to list them in your own dependencies - hence
    // lowering your plugin bundle size, and making sure that
    // you'll use the exact same core modules as the rest of the
    // application.
    //
    // Of course, the regular `require` implementation remains
    // available, so feel free to use the `require` you need for
    // your use case!
  })
};
```

We have our plugin, but now we need to register it so that Yarn knows where to find it. To do this, we'll just add an entry within the `.yarnrc.yml` file at the root of the repository:

```yaml
plugins:
  - ./plugin-hello-world.js
```

That's it! You have your first plugin, congratulations! Of course it doesn't do much (or anything at all, really), but we'll see how to extend it to make it more powerful.

## All-in-one plugin builder

As we saw, plugins are meant to be standalone JavaScript source files. It's very possible to author them by hand, especially if you only need a small one, but once you start adding multiple commands it can become a bit more complicated. To make this process easyer, we maintain a package called `@yarnpkg/builder`. This builder is to Yarn what Next.js is to web development - it's a tool designed to help creating, building, and managing complex plugins written in TypeScript.

Its documentation can be found on the [dedicated page](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-builder/README.md), but remember that you're not required to use it. Sometimes good old scripts are just fine!

## Adding commands

Plugins can also register their own commands. To do this, we just have to write them using the [`clipanion`](https://github.com/arcanis/clipanion) library - and we don't even have to add it to our dependencies! Let's see an example:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => {
    const {Command} = require(`clipanion`);

    class HelloWorldCommand extends Command {
      async execute() {
        this.context.stdout.write(`This is my very own plugin 😎\n`);
      }
    }

    HelloWorldCommand.addPath(`hello`);

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  }
};
```

Now, try to run `yarn hello`. You'll see your message appear! Note that you can use the full set of features provided by clipanion, including short options, long options, variadic argument lists, ... You can even validate your options using the [`yup`](https://github.com/jquense/yup) library, which we provide. Here's an example where we only accept email addresses as parameter:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => {
    const {Command} = require(`clipanion`);
    const yup = require(`yup`);

    class HelloWorldCommand extends Command {
      async execute() {
        this.context.stdout.write(`Hello ${this.email} 💌\n`);
      }
    }

    // Note: This curious syntax is because @Command.String is actually
    // a decorator! But since they aren't supported in native JS at the
    // moment, we need to call them manually.
    HelloWorldCommand.addOption(`email`, Command.String(`--email`));

    // Similarly we would be able to use a decorator here too, but since
    // we're writing our code in JS-only we need to go through "addPath".
    HelloWorldCommand.addPath(`hello`);

    // Similarly, native JS doesn't support member variable as of today,
    // hence the awkward writing.
    HelloWorldCommand.schema = yup.object().shape({
      email: yup.string().required().email(),
    });

    // Show descriptive usage for a --help argument passed to this command
    HelloWorldCommand.usage = Command.Usage({
      description: `hello world!`,
      details: `
        This command will print a nice message.
      `,
      examples: [[
        `Say hello to an email user`,
        `yarn hello --email acidburn@example.com`,
      ]],
    });

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  },
};
```

## Using hooks

Plugins can register to various events in the Yarn lifetime, and provide them additional information to alter their behavior. To do this, you just need to declare a new `hooks` property in your plugin and add members for each hook you want to listen to:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => ({
    hooks: {
      setupScriptEnvironment(scriptEnv) {
        scriptEnv.HELLO_WORLD = `my first plugin!`;
      },
    },
  })
};
```

In this example, we registered to the `setupScriptEnvironment` hook and used it to inject an argument into the environment. Now, each time you'll run a script, you'll see that your env will contain a new value called `HELLO_WORLD`!

Hooks are numerous, and we're still working on them. Some might be added, removed, or changed, based on your feedback. So if you'd like to do something hooks don't allow you to do yet, come tell us!

> **Note:** We don't yet have a list of hooks. If you're interested to improve this documentation by generating the hook list from our source code, please contact us on our Discord server!

## Using a the Yarn API

Most Yarn's hooks are called with various arguments that tell you more about the context under which the hook is being called. The exact argument list is different for each hook, but in general they are of the types defined in the [`@yarnpkg/core` library](/api).

In this example, we will integrate with the `afterAllInstalled` hook in order to print some basic information about the dependency tree after each install. This hook gets invoked with an additional parameter that is the public [`Project`](/api/classes/yarnpkg_core.project.html) instance where lie most of the information Yarn has collected about the project: dependencies, package manifests, workspace information, and so on.

```js
const fs = require(`fs`);
const util = require(`util`);

module.exports = {
  name: `plugin-project-info`,
  factory: require => {
    const {structUtils} = require(`@yarnpkg/core`);

    return {
      default: {
        hooks: {
          afterAllInstalled(project) {
            let descriptorCount = 0;
            for (const descriptor of project.storedDescriptors.values())
              if (!structUtils.isVirtualDescriptor(descriptor))
                descriptorCount += 1;

            let packageCount = 0;
            for (const pkg of project.storedPackages.values())
              if (!structUtils.isVirtualLocator(pkg))
                packageCount += 1;

            console.log(`This project contains ${descriptorCount} different descriptors that resolve to ${packageCount} packages`);
          }
        }
      }
    };
  }
};
```

This is getting interesting. As you can see, we accessed the [`storedDescriptors`](/api/classes/yarnpkg_core.project.html#storeddescriptors) and [`storedPackages`](/api/classes/yarnpkg_core.project.html#storedpackages) fields from our project instance, and iterated over them to obtain the number of non-virtual items (virtual packages are described in more details [here](/advanced/lexicon#virtual-package)). This is a very simple use case, but we could have done many more things: the project root is located in the [`cwd`](/api/classes/yarnpkg_core.project.html#cwd) property, the workspaces are exposed as [`workspaces`](https://yarnpkg.com/api/classes/yarnpkg_core.project.html#workspaces), the link between descriptors and packages can be made via [`storedResolutions`](/api/classes/yarnpkg_core.project.html#storedresolutions), ... etc.

Note that we've only scratched the surface of the `Project` class instance! The Yarn core provides many other classes (and hooks) that allow you to work with the cache, download packages, trigger http requests, ... and much more, as listed in the [API documentation](/api/). Next time you want to write a plugin, give it a look, there's almost certainly an utility there that will allow you to avoid having to reimplement the wheel.

> **Note:** Our API documentation is still in its infancy and could benefit from the help of dedicated technical writers. In the meantime, we recommend that you also give a look at the source code from the [core plugins](https://github.com/yarnpkg/berry/tree/master/packages), as they all use exactly the same primitives as the ones you can access from your own plugins! For instance, the [TypeScript plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript), which auto-adds `@types` dependency when needed, implements this feature [through a hook](https://github.com/yarnpkg/berry/blob/master/packages/plugin-typescript/sources/index.ts#L133-L134).

