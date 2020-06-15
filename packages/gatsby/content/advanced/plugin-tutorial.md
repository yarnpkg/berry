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

Its documentation can be found on the [dedicated page](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-doctor/README.md).

