import dedent from 'dedent';

export const DEFAULT_OUTPUT = dedent `
  Welcome to the Yarn playground! In order to make it easier for us to
  triage issue, we require that you put here the instructions that will
  allow our automated bot to reproduce your problem.

  ## Rules

  The rules are simple:

  - The editor on the left is a Javascript file. You can write any Node
    code there. You can even use top-level await!

  - We also expose a few Yarn-specific builtins. For example, creating a
    package.json and installing it can be done in just one call to the
    "packageJsonAndRun" builtin, which returns a promise.

  - Finally, we expose the Jest 'expect' library. This means that you can
    write assertions like "expect(myPromise).resolves.toBeTruthy()".

  Your goal is to use these tools to generate a crashing assertion.

  ## Tips

  - Don't use very large packages unless you absolutely have to - the
    sandbox won't like it.

  - To assert that a promise *must* throw, you can use the following
    construct: "expect(myPromise).rejects.toThrow()"

  - The sandbox may go to sleep after some time. If that happens, reload
    the page to reboot it.
`;

export const SELECT_OPTIONS = [{
  value: `default`,
  label: `Empty / Last Input`,
  predefinedInput: ``,
}, {
  value: `yarn`,
  label: `Run a Yarn Command`,
  predefinedInput: dedent `
    const output = await yarn(\`add\`, \`--help\`);

    expect(output).not.toContain(\`yarn yarn\`);
  `,
}, {
  value: `install`,
  label: `Expect a package to be installable`,
  predefinedInput: dedent `
    const installPromise = packageJsonAndInstall({
      dependencies: {
        [\`lodash\`]: \`*\`,
      },
    });

    await expect(installPromise)
      .resolves.toBeTruthy();
  `,
}];

export const LABELS = {
  DEFAULT: {
    text: `nothing to report`,
    color: `#d4d4d4`,
    help: `Fill the template then press run!`,
    type: `info`,
  },
  CHECKING: {
    text: `checking the repo`,
    color: `#d4d4d4`,
    help: `We're checking whether the repository needs to be cloned; please wait`,
    type: `info`,
    loading: true,
  },
  CLONING: {
    text: `cloning the repo`,
    color: `#d4d4d4`,
    help: `We're cloning the repository to run your snippet; please wait`,
    type: `info`,
    loading: true,
  },
  RUNNING: {
    text: `running the repro`,
    color: `#d4d4d4`,
    help: `We're running your snippet on the server; please wait`,
    type: `info`,
    loading: true,
  },
  ERROR: {
    text: `internal error`,
    color: `#000000`,
    help: `Something weird happened when running the reproduction. The playground might be broken.`,
    type: `error`,
  },
  REPRODUCIBLE: {
    text: `reproducible`,
    color: `#8bed92`,
    help: `Your assertions fail their expectations on master`,
    type: `success`,
  },
  UNREPRODUCIBLE: {
    text: `unreproducible`,
    color: `#ff7777`,
    help: `None of your assertions failed when run against master`,
    type: `error`,
  },
  BROKEN: {
    text: `invalid reproduction`,
    color: `#000000`,
    help: `The reproduction case seems broken: It neither passes nor fails due to throwing an unmanaged exception.`,
    type: `error`,
  },
};

export const ENCODING = `base64`;

export const REPO_URL = `https://github.com/yarnpkg/berry`;

export const RAW_REPO_URL = `https://raw.githubusercontent.com/yarnpkg/berry`;

export const SANDBOX_URL = `https://viko0.sse.codesandbox.io`;
