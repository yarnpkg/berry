---
name: "\U0001F47E Compatibility"
about: For packages that don't work.
title: "[Compatibility]"
labels: compatibility
assignees: ''

---

**DO NOT OPEN COMPATIBILITY ISSUES**

Compatibility issues go in two categories:

- Either they are actionable (for instance the problem is that Yarn doesn't is missing
  the `gist:` protocol), in which case you should open either a bug or an enhancement.

- Or they are not actionable (for instance the relevant package is throwing "accessing
  undeclared dependency" errors), in which case you should open a Discussion, and probably
  open a bug upstream.

Some other important notes:

- For undeclared dependencies or missing peer dependencies, you can use the `packageExtensions`
  setting to declare them yourself:
  https://yarnpkg.com/configuration/yarnrc#packageExtensions

- If the `packageExtensions` entries you have to add are widely relevant, consider opening up a
  PR to add it to our builtin list of extensions!
  https://github.com/yarnpkg/berry/blob/master/packages/plugin-compat/sources/extensions.ts#L11

- Our Rulebook is the reference resource explaining why are proper dependency listings important
  not only for Yarn, but for all package managers. We recommend linking it in your upstream issue.
  https://yarnpkg.com/advanced/rulebook

We're sorry you had a bad compat experience, but with!
