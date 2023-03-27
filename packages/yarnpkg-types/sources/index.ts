// Strangely, the tslib error sometimes disappear in the IDE ... so we use ts-ignore rather than ts-expect-error
// eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
// @ts-ignore: TS incorrectly thinks it needs tslib for this type export
export type * as Yarn from './yarn';
