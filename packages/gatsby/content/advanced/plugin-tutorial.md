---
category: advanced
path: /advanced/plugin-tutorial
title: "Plugin Tutorial"
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

## Using commands

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

## Builder

`@yarnpkg/builder` is a tool designed for creating, building, and managing complex plugins.

Its documentation can be found on the [dedicated page](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-builder/README.md).

## Using a plugin to access rich information

Some of Yarn's hooks allow us to integrate more closely by providing a global
public object with rich metadata that Yarn collected about the project.

In this example, we will integrate with the `afterAllInstalled` hook which
gets invoked with an additional parameter that is the public Project object
where you have access to all the information Yarn has collected about the
project: dependencies, package manifest, workspace information, and so on.

In the following `plugin-hello-brave-world.js` plugin example we will capture
this object information in the `_` variable and write its content to a JSON
file so we can further inspect it:

```js
const fs = require("fs");
const util = require("util");

module.exports = {
  name: `plugin-hello-brave-world`,
  factory: require => {
    return {
      default: {
        hooks: {
          afterAllInstalled(_) {
            console.log("🎉 afterAllInstalled hook invoked");
            fs.writeFileSync("afterAll.json", util.inspect(_, false, 10));
          }
        }
      }
    };
  }
};
```

The Project's object structure is defined in
`packages/berry-core/sources/Project.ts` and a partial list of the root level
keys the object has are:

```
Project {
  configuration: {},
  cwd: {},
  workspaces: Map {},
  storedResolutions: Map {},
  storedDescriptors: Map {},
  storedPackages: Map {},
  storedChecksums: Map {},
  ...
}
```

Those `stored*` keys are going to help us understand the dependencies and
build the tree for this project.

To make things simple we're going to run this plugin on an npm project
that has just dependency: `debug`. debug in-turn, has `ms` as a dependency
as well.

The `storedPackages` object is our entry point to get the list of dependencies
for this project, and note that this object also has an entry for the actual
project name as well which is denoted by the `reference: 'workspace:.` key.

Let's see how the `debug` dependency looks like in the `storedPackages` Map:

```
 'a1f870a4a95fff67eeac2388e06345982ebf1149c710f8efe18fe5d1967fec40db60987022a5c6fe55708167d1add4b63bc8ad6f755e20c6fba140d721180595' => { identHash:
    'd027b0b474dd440d333c0ae6200111acff30aa5931aeacf1841b1eb9212edea377606a118ff0f8675b69eabe9ff00db4f2f16659519c82810c6b534f9b8ad82d',
   scope: undefined,
   name: 'debug',
   locatorHash:
    'a1f870a4a95fff67eeac2388e06345982ebf1149c710f8efe18fe5d1967fec40db60987022a5c6fe55708167d1add4b63bc8ad6f755e20c6fba140d721180595',
   reference: 'npm:4.1.1',
   version: '4.1.1',
   languageName: 'node',
   linkType: 'hard',
   dependencies:
    Map {
      '299701b4a21f15498c990a6ec8bf49b0331f01e1d610cefaa6f7040bab1be634be89d1462245207c21d1334b31690861f303a0a71aa94f80445d80b9ee37eaf6' => { identHash:
         '299701b4a21f15498c990a6ec8bf49b0331f01e1d610cefaa6f7040bab1be634be89d1462245207c21d1334b31690861f303a0a71aa94f80445d80b9ee37eaf6',
        scope: undefined,
        name: 'ms',
        descriptorHash:
         '0742408cf974a8f1cd5081a9aec19656dc8016eec3c6e2358f302902e6f1f87241f601911cb45e855f3b0d26160c1520715ae79904c5ed1d29f5383ab906440e',
        range: 'npm:^2.1.1' } },
   peerDependencies: Map {},
   dependenciesMeta: Map {},
   peerDependenciesMeta: Map {},
   bin: Map {} },
 '9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33' => { identHash:
    '299701b4a21f15498c990a6ec8bf49b0331f01e1d610cefaa6f7040bab1be634be89d1462245207c21d1334b31690861f303a0a71aa94f80445d80b9ee37eaf6',
   scope: undefined,
   name: 'ms',
   locatorHash:
    '9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33',
   reference: 'npm:2.1.2',
   version: '2.1.2',
   languageName: 'node',
   linkType: 'hard',
   dependencies: Map {},
   peerDependencies: Map {},
   dependenciesMeta: Map {},
   peerDependenciesMeta: Map {},
   bin: Map {} },
```

The `debug` entry has a unique hash to identify it, some metadata such as the
resolved version, and another nested `dependencies` object which lists those dependencies that `debug` depends upon. You'll notice though that `ms` which
shows up in the nested dependencies object isn't resolved, and it is only
denoted by a `range`.

To resolve the nested dependencies we need to use the `descriptorHash` and
consult the `storedResolutions` map, which looks as follows:

```
  storedResolutions:
   Map {
     '35f50d92512bedba8fbf78bdeae4f2bce60934a798f5e0a0ab58b087fb7dc73880c7ffee2e135c15e48ca70687336bbdf4163e75da3f90b55da5ba5e41d36051' => '35f50d92512bedba8fbf78bdeae4f2bce60934a798f5e0a0ab58b087fb7dc73880c7ffee2e135c15e48ca70687336bbdf4163e75da3f90b55da5ba5e41d36051',
     'ee78c55248c8a07a4079ce749bc462124c923d7b990785b50150c417b2821ca3363767b8dc304d80d4feae3faf9f95e1c2c46cebc582b81fe70a8f45a69b6377' => 'a1f870a4a95fff67eeac2388e06345982ebf1149c710f8efe18fe5d1967fec40db60987022a5c6fe55708167d1add4b63bc8ad6f755e20c6fba140d721180595',
     '0742408cf974a8f1cd5081a9aec19656dc8016eec3c6e2358f302902e6f1f87241f601911cb45e855f3b0d26160c1520715ae79904c5ed1d29f5383ab906440e' => '9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33' },
```

We can find `ms`'s descriptorHash of `0742408cf974a8f1cd5081a9aec19656dc8016eec3c6e2358f302902e6f1f87241f601911cb45e855f3b0d26160c1520715ae79904c5ed1d29f5383ab906440e` to be the third element in `storedResolutions` and it references the hash `9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33` which is then mapped again to
an dependency entry in the `storedPackages` map, but this time it's the fully
resolved dependency metadata of `ms`:

```
 '9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33' => { identHash:
    '299701b4a21f15498c990a6ec8bf49b0331f01e1d610cefaa6f7040bab1be634be89d1462245207c21d1334b31690861f303a0a71aa94f80445d80b9ee37eaf6',
   scope: undefined,
   name: 'ms',
   locatorHash:
    '9455a02525b0e2c50eca4e204d71900a775107249d4245c1ea1f95e3f124c8a1d27484b29ccea934895da4d0273b22dc95cefd0561c39490cd7c86ab4404ca33',
   reference: 'npm:2.1.2',
   version: '2.1.2',
   languageName: 'node',
   linkType: 'hard',
   dependencies: Map {},
   peerDependencies: Map {},
   dependenciesMeta: Map {},
   peerDependenciesMeta: Map {},
   bin: Map {} },
```
