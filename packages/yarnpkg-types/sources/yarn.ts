import * as Constraints from './constraints';

export {Constraints};

export type Config = {
  /**
   * Called each time the constraints engine runs. You can then use the
   * methods from the provided context to assert values on any of your
   * workspaces' definitions.
   *
   * The constraints engine is declarative, and you don't need to compare
   * values yourself except in some specific situations. For instance, if
   * you wish to ensure that all workspaces define a specific license, you
   * would write something like this:
   *
   * ```ts
   * // Yes: declarative
   * for (const w of Yarn.workspaces()) {
   *   w.set(`license`, `MIT`);
   * }
   *
   * // No: imperative
   * for (const w of Yarn.workspaces()) {
   *   if (w.manifest.license !== `MIT`) {
   *     w.set(`license`, `MIT`);
   *   }
   * }
   * ```
   *
   * Note that the presence of this field will disable any evaluation of
   * the `constraints.pro` file, although no warning is currently emitted.
   *
   * @param ctx Context
   * @returns
   */
  constraints: (ctx: Constraints.Context) => Promise<void>;
};
