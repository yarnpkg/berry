const cp = require('child_process');

exports.execFile = function(
  path: string,
  args: Array<string>,
  options: Object,
): Promise<{stdout: Buffer, stderr: Buffer}> {
  return new Promise((resolve, reject) => {
    cp.execFile(path, args, options, (error, stdout, stderr) => {
      stdout = stdout.replace(/\r\n?/g, `\n`);
      stderr = stderr.replace(/\r\n?/g, `\n`);

      if (stdout.length > 0 && !stdout.endsWith(`\n`))
        stdout += `<no line return>\n`;
      if (stderr.length > 0 && !stderr.endsWith(`\n`))
        stderr += `<no line return>\n`;

      if (error)
        error.message += `\n\n===== stdout:\n\n\`\`\`\n${stdout}\`\`\`\n\n===== stderr:\n\n\`\`\`\n${stderr}\`\`\`\n\n`;

      const result = error ? error : {};
      Object.assign(result, {stdout, stderr});

      if (error) {
        reject(result);
      } else {
        resolve(result);
      }
    });
  });
};
