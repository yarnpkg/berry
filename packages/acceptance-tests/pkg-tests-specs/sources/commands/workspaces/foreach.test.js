const {
  fs: {writeJson, writeFile},
} = require('pkg-tests-core');

async function setupWorkspaces(path) {
  await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-workspaces-tools.js`))}\n`);
  await writeFile(`${path}/packages/workspace-a/server.js`, getServerContent());
  await writeJson(`${path}/packages/workspace-a/package.json`, {
    name: `workspace-a`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace A`,
      start: `node server.js`,
    }
  });

  await writeFile(`${path}/packages/workspace-b/client.js`, getClientContent());
  await writeJson(`${path}/packages/workspace-b/package.json`, {
    name: `workspace-b`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace B`,
      start: `node client.js`
    },
    dependencies: {
      [`workspace-a`]: `workspace:*`,
      [`workspace-c`]: `workspace:*`
    }
  });

  await writeJson(`${path}/packages/workspace-c/package.json`, {
    name: `workspace-c`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace C`,
    },
    dependencies: {
      [`workspace-a`]: `workspace:*`
    }
  });
}

describe(`Commands`, () => {
  describe(`workspace foreach`, () => {
    test(
      `runs scripts in parallel with interlaced report`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--interlaced`, `run`, `start`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `runs scripts in parallel in topological order`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--with-dependencies`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `runs scripts topological order by default`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `shows prefix with flag`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `--prefixed`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `run script only on included workspaces using [-i,--include]`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `--prefixed`, `--include`, `workspace-a`, `-i`, `workspace-b`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `excludes workspaces from running scripts using [-x,--exclude]`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `--prefixed`, `--exclude`, `workspace-a`, `-x`, `workspace-b`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );
  });
});

const PORT = 8078;

function getServerContent() {
  return `
  const net = require('net');
  let pingCount = 0;

  const server = net.createServer(socket => {
    socket.on('data', () => {
      if (++pingCount > 10) {
        socket.end();

        return server.close();
      }

      console.log('PING');
      setTimeout(() => {
        socket.write('ping');
      });
    });
  });

  // server.on('error', () => server.close());
  server.on('error', (e) => {
    console.error(e);
    server.close()
  });
  server.listen(${PORT});
  `;
}


function getClientContent() {
  return `
  const net = require('net');

  const client = new net.Socket();
  let retries = 5;

  const connect = () => {
    client.connect(${PORT}, () => client.write('pong'));
  };

  client.on('error', error => {
    if (--retries < 0)
      throw new Error('Server not available');

    if (error.code === 'ECONNREFUSED')
      setTimeout(connect, 5);
  });

  client.on('close', () => client.destroy());
  client.on('data', () => {
    console.log('PONG');
    client.write('pong');
  });

  connect();
  `;
}
