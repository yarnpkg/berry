declare global {
  namespace Yarn {
    export type Config = {
      constraints: (ctx: Yarn.Constraints.Context) => Promise<void>;
    };
  }
}

export {};
