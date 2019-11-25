import {PortablePath, npath} from '@yarnpkg/fslib';
import cp                    from 'child_process';

interface Options {
  cwd: PortablePath;
  env?: Record<string, string>;
}

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
} | Error & {
  stdout: string;
  stderr: string;
};

export const execFile = (
  path: string,
  args: Array<string>,
  options: Options,
): Promise<ExecResult> => {
  return new Promise((resolve, reject) => {
    cp.execFile(path, args, {
      ...options,
      cwd: options.cwd ? npath.fromPortablePath(options.cwd) : undefined,
    }, (error, stdout, stderr) => {
      stdout = stdout.replace(/\r\n?/g, `\n`);
      stderr = stderr.replace(/\r\n?/g, `\n`);

      if (stdout.length > 0 && !stdout.endsWith(`\n`))
        stdout += `<no line return>\n`;
      if (stderr.length > 0 && !stderr.endsWith(`\n`))
        stderr += `<no line return>\n`;

      if (error)
        error.message += `\n\n===== stdout:\n\n\`\`\`\n${stdout}\`\`\`\n\n===== stderr:\n\n\`\`\`\n${stderr}\`\`\`\n\n`;

      if (error) {
        reject(Object.assign(error, {stdout, stderr}));
      } else {
        resolve({
          code: 0,
          stdout,
          stderr,
        });
      }
    });
  });
};
