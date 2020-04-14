import ky       from 'ky';

import {STATUS} from '../../src/components/playground/constants';

export const PLAYGROUND_SANDBOX_URL = typeof window !== `undefined` && (
  window.location !== window.parent.location
    ? document.referrer
    : document.location.href
);

export const checkRepo = async ({statusState: [, setStatus]}) => {
  setStatus(STATUS.CHECKING);
  const checkRepoData = await ky.get(`${PLAYGROUND_SANDBOX_URL}/api/check-repo`, {
    timeout: false,
  }).json();

  if (checkRepoData.status === `success`) {
    return checkRepoData.shouldClone;
  } else {
    setStatus(STATUS.ERROR);
    throw new Error(`An error has occurred while checking the repository`);
  }
};

export const cloneRepo = async ({statusState: [, setStatus]}) => {
  setStatus(STATUS.CLONING);
  const cloneRepoData = await ky.get(`${PLAYGROUND_SANDBOX_URL}/api/clone-repo`, {
    timeout: false,
  }).json();

  if (cloneRepoData.status === `error`) {
    setStatus(STATUS.ERROR);
    throw new Error(`An error has occurred while cloning the repository`);
  }
};

export const runReproduction = async (
  {inputState: [input], statusState: [, setStatus]}
) => {
  setStatus(STATUS.RUNNING);
  const sherlockData = await ky.get(`${PLAYGROUND_SANDBOX_URL}/api/sherlock`, {
    searchParams: {
      code: input,
    },
    timeout: false,
  }).json();

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

