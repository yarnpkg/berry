---
name: "\U0001F41E Bug report"
about: For unintended behaviors. Missing features aren't bugs.
title: "[Bug]"
labels: bug
assignees: ''

---

- [ ] I'd be willing to implement a fix

**Describe the bug**

A clear and concise description of what the bug is. A bug is **unintended**. A feature not being
implemented is **not a bug**, and your issue may be closed for misleading labeling.

**To Reproduce**

The _minimal_ information needed to reproduce your issue (ideally a package.json with a single dep).
Note that bugs without minimal reproductions **will** be closed as non-actionable.

**IMPORTANT**: We **strongly** prefer reproductions that use Sherlock. Please check our documentation
for more information: https://yarnpkg.com/advanced/sherlock

<details>
  <summary>Reproduction</summary>

  ```js repro
  // Sherlock reproduction. For instance:
  await packageJsonAndInstall({
    dependencies: {
      [`packageName`]: `x.y.z`,
    },
  });
  ```
</details>

**Screenshots**

If applicable, add screenshots to help explain your problem.

**Environment if relevant (please complete the following information):**

 - OS: [e.g. OSX, Linux, Windows, ...]
 - Node version [e.g. 8.15.0, 10.15.1, ...]
 - Yarn version [e.g. 2.4.0, ...]

**Additional context**

Add any other context about the problem here.
