import execa                from 'execa';
import {Readable, Writable} from 'stream';

export type ExecOptions = {
  cwd: string,
  env?: {[key: string]: string | undefined},
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  paths?: Array<string>,
};

export async function execFile(fileName: string, args: Array<string>, {cwd, env = process.env, stdin, stdout, stderr, paths = []}: ExecOptions) {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === process.stdin)
    stdio[0] = stdin;
  if (stdout === process.stdout)
    stdio[1] = stdout;
  if (stderr === process.stderr)
    stdio[2] = stderr;

  const subprocess = execa(fileName, args, {cwd, env, stdio});

  if (stdin !== process.stdin)
    stdin.pipe(subprocess.stdin);
  if (stdout !== process.stdout)
    subprocess.stdout.pipe(stdout);
  if (stderr !== process.stderr)
    subprocess.stderr.pipe(stderr);

  await subprocess;
}
