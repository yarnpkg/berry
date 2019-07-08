---
category: advanced
path: /advanced/plugin-tutorial
title: "Plugin Tutorial"
---

Starting from the v2, Yarn now supports plugins. For more information about what they are and in which case you'd want to use them, consult the [dedicated page](/features/plugins). We'll talk here about the exact steps needed to write one. It's quite simple, really!

## What does a plugin look like?

Plugins are scripts that get loaded at runtime by Yarn, and that can inject new behaviors into it. They also can require some packages provided by Yarn itself, such as `@berry/core`. This allows you to use the exact same core API as the Yarn binary currently in use, kinda like if it was a peer dependency!

> **Important:** Since plugins are loaded before Yarn starts (and thus before you make your first install), it's strongly advised to write your plugins in such a way that they work without dependencies. If that becomes difficult, know that we provide a tool that can bundle your plugins into a single Javascript file, ready to be published.

## Writing our first plugin

Open in a text editor a new file called `plugin-hello-world.js`, and type the following code:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => ({
    default: {},
  })
};
```

We have our plugin, but now we need to register it so that Yarn knows where to find it. To do this, we'll just add an entry within the `.yarnrc` file at the root of the repository:

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
    default: {
      hooks: {
        setupScriptEnvironment(scriptEnv) {
          scriptEnv.HELLO_WORLD = `my first plugin!`;
        },
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
  factory: require => ({
    default: {
      commands: [
        clipanion => clipanion.command(`hello world`).action(({stdout}) => {
          stdout.write(`This is my very own plugin 😎`);
        }),
      ],
    },
  })
};
```

Now, try to run `yarn hello world`. You'll see your message appear! Note that you can use the full set of features provided by clipanion, including short options, long options, variadic argument lists, ... You can even validate your options using the [`yup`](https://github.com/jquense/yup) library, which we provide. Here's an example where we only accept email addresses as parameter:

```js
module.exports = {
  name: `plugin-hello-world`,
  factory: require => {
    // We must require yup, but we don't have to add it to our dependencies! It's bundled with Yarn itself, and we can access it using the `require` function in parameter.
    const yup = require(`yup`);

    return {
      default: {
        commands: [
          clipanion => clipanion.command(`my login [--email EMAIL]`).validate({
            email: yup.string().required().email(),
          }).action(({stdout, email}) => {
            stdout.write(`Logged to ${email} 💌`);
          }),
        ],
      };
    },
  })
};
```
