import fetch    from 'unfetch';

import {STATUS} from '../../src/components/playground/constants';

export const PLAYGROUND_SANDBOX_URL = typeof window !== `undefined` && (
  window.location !== window.parent.location
    ? document.referrer
    : document.location.href
);

export const checkRepo = async ({statusState: [, setStatus]}) => {
  setStatus(STATUS.CHECKING);
  const checkRepoData = await (await fetch(`${PLAYGROUND_SANDBOX_URL}api/check-repo`)).json();

  if (checkRepoData.status === `success`) {
    return checkRepoData.shouldClone;
  } else {
    setStatus(STATUS.ERROR);
    throw new Error(`An error has occurred while checking the repository`);
  }
};

export const cloneRepo = async ({statusState: [, setStatus]}) => {
  setStatus(STATUS.CLONING);
  const cloneRepoData = await (await fetch(`${PLAYGROUND_SANDBOX_URL}api/clone-repo`)).json();

  if (cloneRepoData.status === `error`) {
    setStatus(STATUS.ERROR);
    throw new Error(`An error has occurred while cloning the repository`);
  }
};

export const runReproduction = async (
  {inputState: [input], statusState: [, setStatus]}
) => {
  setStatus(STATUS.RUNNING);
  const sherlockData = await (await fetch(
    `${PLAYGROUND_SANDBOX_URL}api/sherlock?code=${encodeURIComponent(input)}`)
  ).json();

  if (sherlockData.status === `success`) {
    setStatus(STATUS.FINISHED);
    return sherlockData.executionResult;
  } else {
    setStatus(STATUS.ERROR);
    throw new Error(`An error has occurred while running the reproduction`);
  }
};

export const runInput = async (state) => {
  const shouldClone = await checkRepo(state);

  if (shouldClone)
    cloneRepo(state);

  return runReproduction(state);
};

