/* tslint:disable */
/* eslint-disable */
/**
* # Safety
*
* **Everything** assumes that the bytes passed in are valid UTF-8 and very bad things will happen if they aren't.
* @param {Uint8Array} input
* @param {boolean} overwrite_duplicates
* @returns {any}
*/
export function parse(input: Uint8Array, overwrite_duplicates: boolean): any;
