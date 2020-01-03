const {readFileSync} = require(`fs`);
const str = readFileSync(process.stdin.fd, `utf8`);

process.stdout.write(`${JSON.stringify(str)}\n`);
