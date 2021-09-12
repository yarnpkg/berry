import {Buffer}                                      from 'buffer';
import copy                                          from 'copy-to-clipboard';
import dedent                                        from 'dedent';
import indentString                                  from 'indent-string';
import fetch                                         from 'unfetch';

import {LABELS, ENCODING, RAW_REPO_URL, SANDBOX_URL} from '../../src/components/playground/constants';

const fetchJson = async (url, options) => {
  const req = await fetch(url, options);
  const text = await req.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log(url, text);
    throw error;
  }
};

const fetchJsonFromSandbox = (url, options) => fetchJson(SANDBOX_URL + url, options);

export const checkRepo = async ({setLabel}) => {
  setLabel(LABELS.CHECKING);
  const checkRepoData = await fetchJsonFromSandbox(`/api/check-repo`);

  if (checkRepoData.status === `success`) {
    return checkRepoData.shouldClone;
  } else {
    setLabel(LABELS.ERROR);
    throw new Error(`An error has occurred while checking the repository`);
  }
};

export const cloneRepo = async ({setLabel}) => {
  setLabel(LABELS.CLONING);
  const cloneRepoData = await fetchJsonFromSandbox(`/api/clone-repo`);

  if (cloneRepoData.status === `error`) {
    setLabel(LABELS.ERROR);
    throw new Error(`An error has occurred while cloning the repository`);
  }
};

export const runReproduction = async (input, {setLabel}) => {
  setLabel(LABELS.RUNNING);
  const sherlockData = await fetchJsonFromSandbox(`/api/sherlock?code=${encodeURIComponent(input)}`);

  if (sherlockData.status === `success`) {
    return sherlockData.executionResult;
  } else {
    setLabel(LABELS.ERROR);
    throw new Error(`An error has occurred while running the reproduction`);
  }
};

export const runInput = async (input, {setLabel}) => {
  const shouldClone = await checkRepo({setLabel});

  if (shouldClone)
    await cloneRepo({setLabel});

  return await runReproduction(input, {setLabel});
};

export const encodeInput = input => Buffer.from(input).toString(ENCODING);

export const decodeInput = input => Buffer.from(input, ENCODING).toString();

export const getShareableUrl = input => new URL(`/playground?code=${
  encodeURIComponent(encodeInput(input))
}`, window.location.href);

export const parseShareableUrl = url => {
  const parsedUrl = new URL(url);

  return {
    url: parsedUrl,
    decodedInput: decodeInput(parsedUrl.searchParams.get(`code`) || ``),
  };
};

export const openUrl = url => window.open(url);

export const copyToClipboard = text => copy(text);

export const getGithubBugReportTemplate = async () => {
  const req = await fetch(`${RAW_REPO_URL}/master/.github/ISSUE_TEMPLATE/bug-report.md`);

  return await req.text();
};

export const getFilledGithubBugReportTemplate = async (input, output) => {
  // Remove frontmatter
  const template = (await getGithubBugReportTemplate()).replace(/^---[\s\S]+---\n\n/, ``);

  return template.replace(
    indentString(getPreview(`// Sherlock reproduction`), 2),
    indentString(getShareableMarkdownDigest(input, output), 2),
  );
};

export const getShareableMarkdownLink = input => `[Playground](${getShareableUrl(input)})`;

export const getPreview = input => dedent`
  \`\`\`js repro
  ${input}
  \`\`\`
`;

export const getOutput = output => dedent`
  Output:

  \`\`\`
  ${output}
  \`\`\`
`;

export const getShareableMarkdownDigest = (input, output) => dedent`
  ---

  ${getShareableMarkdownLink(input)}

  ${getPreview(input)}

  ${getOutput(output)}

  ---
`;

export const createSandbox = async input => {
  const {sandbox_id: id} = await fetchJson(`https://codesandbox.io/api/v1/sandboxes/define?json=1`, {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`,
      Accept: `application/json`,
    },
    body: JSON.stringify({
      files: {
        'package.json': {
          content: {
            dependencies: {},
          },
        },
        'index.js': {
          content: input,
        },
        'sandbox.config.json': {
          content: {
            template: `node`,
          },
        },
      },
    }),
  });

  return {
    id,
    url: `https://codesandbox.io/s/${id}`,
  };
};

export const isLocalStorageSupported = () => {
  if (typeof window === `undefined`)
    return false;

  try {
    const key = `__test-key__`;
    localStorage.setItem(key, ``);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
