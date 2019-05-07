const cp = require(`child_process`);

const [node, script, name, ... rest] = process.argv;

let {NODE_OPTIONS} = process.env;
NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${require.resolve(`@berry/pnpify`)}`.trim();

const child = cp.spawn(name, rest, {
  env: {... process.env, NODE_OPTIONS},
  stdio: `inherit`,
});

child.on(`exit`, code => {
  process.exitCode = code !== null ? code : 1;
});
