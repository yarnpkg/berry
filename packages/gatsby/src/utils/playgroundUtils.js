import fetch    from 'unfetch';

import {LABELS} from '../../src/components/playground/constants';

const TARGET = `https://viko0.sse.codesandbox.io`;

const fetchJson = async url => {
  const req = await fetch(TARGET + url);
  const text = await req.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.log(TARGET + url, text);
    throw error;
  }
};

export const checkRepo = async ({setLabel}) => {
  setLabel(LABELS.CHECKING);
  const checkRepoData = await fetchJson(`/api/check-repo`);

  if (checkRepoData.status === `success`) {
    return checkRepoData.shouldClone;
  } else {
    setLabel(LABELS.ERROR);
    throw new Error(`An error has occurred while checking the repository`);
  }
};

export const cloneRepo = async ({setLabel}) => {
  setLabel(LABELS.CLONING);
  const cloneRepoData = await fetchJson(`/api/clone-repo`);

  if (cloneRepoData.status === `error`) {
    setLabel(LABELS.ERROR);
    throw new Error(`An error has occurred while cloning the repository`);
  }
};

export const runReproduction = async (input, {setLabel}) => {
  setLabel(LABELS.RUNNING);
  const sherlockData = await fetchJson(`/api/sherlock?code=${encodeURIComponent(input)}`);

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

