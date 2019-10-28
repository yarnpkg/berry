declare namespace NodeJS {
  namespace Module {
    const _cache: {[p: string]: NodeModule};
    const _extensions: {[ext: string]: any};

    function _findPath(request: string, paths: Array<string>|null, isMain: boolean): string | false;
    function _nodeModulePaths(from: string): Array<string>;
    function _resolveFilename(request: string, parent: NodeModule | null, isMain: boolean, options?: {[key: string]: any}): string;
    function _load(request: string, parent: NodeModule | null, isMain: boolean): any;

    //new(p: string, parent: NodeModule | null): NodeModule;
  }
}
