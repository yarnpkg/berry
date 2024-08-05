---
category: advanced
slug: /advanced/plugin-tutorial
title: "Plugin Tutorial"
description: A basic plugin tutorial which shows how to work with Yarn's plugin API.
---

Starting from the Yarn 2, Yarn now supports plugins. For more information about what they are and in which case you'd want to use them, consult the [dedicated page](/features/extensibility). We'll talk here about the exact steps needed to write one. It's quite simple, really!

## What does a plugin look like?

Plugins are scripts that get loaded at runtime by Yarn, and that can inject new behaviors into it. They also can require some packages provided by Yarn itself, such as `@yarnpkg/core`. This allows you to use the exact same core API as the Yarn binary currently in use, kinda like if it was a peer dependency!

:::info
Since plugins are loaded before Yarn starts (and thus before you make your first install), it's strongly advised to write your plugins in such a way that they work without dependencies. If that becomes difficult, know that we provide a powerful tool ([`@yarnpkg/builder`](#all-in-one-plugin-builder) that can bundle your plugins into a single Javascript file, ready to be published.
:::

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

As we saw, plugins are meant to be standalone JavaScript source files. It's very possible to author them by hand, especially if you only need a small one, but once you start adding multiple commands it can become a bit more complicated. To make this process easier, we maintain a package called `@yarnpkg/builder`. This builder is to Yarn what Next.js is to web development - it's a tool designed to help creating, building, and managing complex plugins written in TypeScript.

Its documentation can be found on the [dedicated page](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-builder/README.md), but remember that you're not required to use it. Sometimes good old scripts are just fine!

## Adding commands

Plugins can also register their own commands. To do this, we just have to write them using the [`clipanion`](https://github.com/arcanis/clipanion) library - and we don't even have to add it to our dependencies! Let's see an example:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => {
    const {BaseCommand} = require(`@yarnpkg/cli`);

    class HelloWorldCommand extends BaseCommand {
      static paths = [[`hello`]];

      async execute() {
        this.context.stdout.write(`This is my very own plugin 😎\n`);
      }
    }

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  }
};
```

Now, try to run `yarn hello`. You'll see your message appear! Note that you can use the full set of features provided by clipanion, including short options, long options, variadic argument lists, ... You can even validate your options using the [`typanion`](https://github.com/arcanis/typanion) library, which we provide. Here's an example where we only accept numbers as parameter:

```js
module.exports = {
  name: `plugin-addition`,
  factory: require => {
    const {BaseCommand} = require(`@yarnpkg/cli`);
    const {Command, Option} = require(`clipanion`);
    const t = require(`typanion`);

    class AdditionCommand extends BaseCommand {
      static paths = [[`addition`]];

      // Show descriptive usage for a --help argument passed to this command
      static usage = Command.Usage({
        description: `hello world!`,
        details: `
          This command will print a nice message.
        `,
        examples: [[
          `Add two numbers together`,
          `yarn addition 42 10`,
        ]],
      });

      a = Option.String({validator: t.isNumber()});
      b = Option.String({validator: t.isNumber()});

      async execute() {
        this.context.stdout.write(`${this.a}+${this.b}=${this.a + this.b}\n`);
      }
    }

    return {
      commands: [
        AdditionCommand,
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
      setupScriptEnvironment(project, scriptEnv) {
        scriptEnv.HELLO_WORLD = `my first plugin!`;
      },
    },
  })
};
```

In this example, we registered to the `setupScriptEnvironment` hook and used it to inject an argument into the environment. Now, each time you'll run a script, you'll see that your env will contain a new value called `HELLO_WORLD`!

Hooks are numerous, and we're still working on them. Some might be added, removed, or changed, based on your feedback. So if you'd like to do something hooks don't allow you to do yet, come tell us!

## Using the Yarn API

Most of Yarn's hooks are called with various arguments that tell you more about the context under which the hook is being called. The exact argument list is different for each hook, but in general they are of the types defined in the `@yarnpkg/core` library.

In this example, we will integrate with the `afterAllInstalled` hook in order to print some basic information about the dependency tree after each install. This hook gets invoked with an additional parameter that is the public `Project` instance where lie most of the information Yarn has collected about the project: dependencies, package manifests, workspace information, and so on.

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

This is getting interesting. As you can see, we accessed the `storedDescriptors` and `storedPackages` fields from our project instance, and iterated over them to obtain the number of non-virtual items (virtual packages are described in more details [here](/advanced/lexicon#virtual-package)). This is a very simple use case, but we could have done many more things: the project root is located in the `cwd` property, the workspaces are exposed as `workspaces`, the link between descriptors and packages can be made via `storedResolutions`, ... etc.

Note that we've only scratched the surface of the `Project` class instance! The Yarn core provides many other classes (and hooks) that allow you to work with the cache, download packages, trigger http requests, ... and much more. Next time you want to write a plugin, give it a look, there's almost certainly an utility there that will allow you to avoid having to reimplement the wheel.

## Dynamically loading plugins using the `YARN_PLUGINS` environment variable

While plugins are usually declared inside `.yarnrc.yml` configuration files, those represent the user-facing configuration that third-party tools shouldn't modify without the user's permission.

The `YARN_PLUGINS` environment variable is a semicolon-separated list of plugin paths that Yarn will dynamically load when called. Paths are resolved relative to the `startingCwd` Yarn is called in.

Packages can use this mechanism to dynamically register plugins and query the Yarn API using commands without having to explicitly depend on the Yarn packages and deal with potential version mismatches.

## Official hooks

Our new website doesn't support generating the hook list yet; sorry :(
