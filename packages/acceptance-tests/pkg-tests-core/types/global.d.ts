interface PackageDriver {
  (packageJson: Record<string, any>, subDefinition: Record<string, any> | RunFunction, fn?: RunFunction): any;
  getPackageManagerName: () => string;
  withConfig: (definition: Record<string, any>) => PackageDriver;
}

type RunFunction = (
  {path, run, source}:
  {
    path: string,
    run: (...args: any[]) => Promise<ExecResult>,
    source: (script: string, callDefinition?: Record<string, any>) => Promise<Record<string, any>>
  }
) => void;

type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
} | Error & {
  stdout: string;
  stderr: string;
};

declare var makeTemporaryEnv: PackageDriver;

declare namespace NodeJS {
  interface Global {
    makeTemporaryEnv: PackageDriver;
  }
}
