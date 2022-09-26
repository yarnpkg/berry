import NextCors      from 'nextjs-cors';

import {WEBSITE_URL} from './constants';

export function setupCors(cb) {
  return async (req, res) => {
    await NextCors(req, res, {
      methods: [`GET`],
      origin: WEBSITE_URL,
    });

    return await cb(req, res);
  };
}
