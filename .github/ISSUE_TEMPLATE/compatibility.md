---
name: "\U0001F47E Compatibility"
about: For packages that don't work.
title: "[Compatibility]"
labels: compatibility
assignees: ''

---

**DO NOT OPEN COMPATIBILITY ISSUES**

Compatibility issues go in two categories:

- Either they are actionable (for instance the problem is that Yarn is missing support for
  the `gist:` protocol), in which case you should open a bug (or an enhancement in this
  particular example).

- Or they are not actionable (for instance the relevant package is throwing "accessing
  undeclared dependency" errors), in which case you should open a Discussion, and probably
  also an upstream bug.

Some other important notes:

- For undeclared dependencies or missing peer dependencies, you can use the `packageExtensions`
  setting to declare them yourself:
  https://yarnpkg.com/configuration/yarnrc#packageExtensions

- If the `packageExtensions` entries you have to add are widely relevant, consider opening up a
  PR to add them to our builtin extension list!
  https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-extensions/sources/index.ts#L11

- The Rulebook is our reference resource, explaining why proper dependency listings are important
  not only for Yarn, but for all package managers. We recommend referencing it in your upstream issues.
  https://yarnpkg.com/advanced/rulebook

We're sorry you've had a bad compatibility experience! Thankfully, the mitigations we have implemented
should be enough to let you move forward. If it's not the case and you're still feeling stuck, feel
free to open a Discussion thread and our community will try its best to help you.
