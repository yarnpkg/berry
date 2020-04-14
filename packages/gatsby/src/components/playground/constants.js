import {mdiInformationOutline, mdiAlertCircleOutline} from '@mdi/js';

export const PLAYGROUND_SANDBOX_URL = window.location !== window.parent.location
  ? document.referrer
  : document.location.href;

export const SELECT_OPTIONS = [
  {
    value: `empty`,
    label: `Empty`,
    predefinedInput: ``,
    selected: true,
  },
  {
    value: `yarn`,
    label: `Run a Yarn Command`,
    predefinedInput: `
      const output = await yarn(\`add\`, \`--help\`);

      expect(output).not.toContain(\`yarn yarn\`);
    `,
  },
];

export const STATUS = {
  READY: `Ready`,
  CHECKING: `Checking Repository`,
  CLONING: `Cloning Repository`,
  RUNNING: `Running Reproduction`,
  FINISHED: `Finished`,
  ERROR: `Error`,
};

export const LABELS = {
  REPRODUCIBLE: {
    text: `reproducible`,
    color: `#8bed92`,
    help: `Assertion failed: This issue reproduces on master.`,
    icon: mdiInformationOutline,
    type: `success`,
  },
  UNREPRODUCIBLE: {
    text: `unreproducible`,
    color: `#ff7777`,
    help: `Assertion passed: This issue doesn't reproduce on master.`,
    icon: mdiAlertCircleOutline,
    type: `error`,
  },
  BROKEN: {
    text: `broken-repro`,
    color: `#000000`,
    help: `The reproduction case seems broken: It neither passes nor fails due to throwing an unmanaged exception.`,
    icon: mdiAlertCircleOutline,
    type: `error`,
  },
};
