import {Hunk} from './parse';

export class UnmatchedHunkError extends Error {
  constructor(index: number, public hunk: Hunk) {
    super(`Cannot apply hunk #${index + 1}`);
  }
}
