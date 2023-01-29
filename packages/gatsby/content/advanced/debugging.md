---
category: advanced
path: /advanced/debugging
title: "Debugging Quickstart"
description: Debug internal errors in Yarn without building from source.
---

If you're experiencing an internal error with Yarn Berry you can download an unminified release from the GitHub CI artifacts to gather more information and attach a debugger. This does not require cloning the Yarn Berry repo or building from source.

Let's say you run into an issue running `yarn` such as:

```
❯ yarn config -v
Internal Error: Expected value ([object Object]) to be a string in /home/you/some_repo/.yarnrc.yml (in /home/you/some_repo/.yarnrc.yml)
    at /home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:17330
    at jk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:17626)
    at Vk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:16917)
    at dPe (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:18512)
    at jk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:17045)
    at Vk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:16917)
    at pPe (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:18174)
    at jk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:17013)
    at Vk (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:16917)
    at dPe (/home/you/some_repo/.yarn/releases/yarn-3.3.0.cjs:391:18512)
❯ 
```

This doesn't say much because Yarn's code is minified to improve performance. Let's fix that!

## Finding and using an unminified build of Yarn Berry

Yarn is developed and released on GitHub, so we can fetch the unminified build there. Note there are references on npm and unpkg like "yarn@3.3.0" - they're not what we need.

Start on the releases page: https://github.com/yarnpkg/berry/releases/

![](/unminified-yarn-01.png)

Choose a release to download:

![](/unminified-yarn-02.png)

Find the CI pipeline that built the artifacts and navigate to its "Summary" tab. The artifacts are at the bottom of the page.

![](/unminified-yarn-03.png)
![](/unminified-yarn-04.png)
![](/unminified-yarn-05.png)

Unzip the artifacts and move the `yarn.js` somewhere memorable such as `<root>/.yarn/releases/yarn-3.3.0-github-artifact.js`. Finally, point your `.yarnrc.yml` to this new release:

```yml
# yarnPath: .yarn/releases/yarn-3.3.0.cjs
yarnPath: .yarn/releases/yarn-3.3.0-artifact.js
```

Re-running the bug now shows more readable stacktraces:

```
❯ yarn config -v
Internal Error: Expected value ([object Object]) to be a string in /home/you/some_repo/.yarnrc.yml (in /home/you/some_repo/.yarnrc.yml)
    at interpretValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70705:15)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70724:25)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseMap (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70756:34)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70695:16)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseShape (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70742:28)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70693:16)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseMap (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70756:34)
❯ 
```

You'll notice that this is looping and it's not the root of the stack. We can fix this by passing the Node.js flag `--stack-trace-limit=` (which is *not* a flag for Yarn itself):

```
❯ NODE_OPTIONS="--stack-trace-limit=100" yarn config -v
Internal Error: Expected value ([object Object]) to be a string in /home/you/some_repo/.yarnrc.yml (in /home/you/some_repo/.yarnrc.yml)
    at interpretValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70705:15)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70724:25)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseMap (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70756:34)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70695:16)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseShape (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70742:28)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70693:16)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at parseMap (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70756:34)
    at parseSingleValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70695:16)
    at parseValue (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70683:16)
    at _Configuration.use (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:71153:20)
    at _Configuration.useWithSource (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:71122:14)
    at Function.find (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:70991:23)
    at async exec (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:77304:29)
    at async run (/home/you/some_repo/.yarn/releases/yarn-3.3.0-artifact.js:77291:9)
❯ 
```

Great!

This is definitely a configuration issue somewhere deep in our `.yarnrc.yml`, but it doesn't tell us what `[Object object]` is. We'll have debug this futher. Below are instructions for debugging Yarn with VSCode.

## Debugging with VSCode

Open VSCode's "JavaScript Debug Terminal" either via the Debug sidebar (shown below) or via Ctrl/Cmd+Shift+P. This terminal is special in that it will automatically attach a debugger to all invocations of Node.js. Type the `yarn` command and wait for the error.

![](/debugging-vscode-01.png)

If the debugger doesn't activate (there is no `Debugger attached` log message) for `yarn ...` you can try `node /path/to/yarn ...` where the path to your Yarn executable can be found from running `which yarn` i.e `node $(which yarn) config -v` in Bash/Unix.

If the debugger activates but doesn't pause on the exception, try adding a breakpoint on the last line of the stacktrace by Ctrl+Cmd clicking on the location, i.e: `.../yarn-3.3.0-artifact.js:70705:15`, and then clicking the red circle 🔴 near the line number.

Now inspect the value that Node is paused on:

![](/debugging-vscode-02.png)

Great! We can see that the issue was with identation in `.yarnrc.yml`:

![](/debugging-vscode-03.png)

Please submit your bug or open an MR! Happy debugging.
