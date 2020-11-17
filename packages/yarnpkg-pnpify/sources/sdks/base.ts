import {PortablePath}                           from '@yarnpkg/fslib';
import {PnpApi}                                 from '@yarnpkg/pnp';

import {Wrapper, GenerateBaseWrapper, BaseSdks} from '../generateSdk';

export const generateEslintBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`eslint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/eslint.js` as PortablePath);
  await wrapper.writeFile(`lib/api.js` as PortablePath);

  return wrapper;
};

export const generatePrettierBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`prettier` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`index.js` as PortablePath, {usePnpify: true});

  return wrapper;
};

export const generateTypescriptLanguageServerBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`typescript-language-server` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`lib/cli.js` as PortablePath);

  return wrapper;
};

export const generateTypescriptBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const tsServerMonkeyPatch = `
    tsserver => {
      const {dirname, join} = require(\`path\`);

      // VSCode sends the zip paths to TS using the "zip://" prefix, that TS
      // doesn't understand. This layer makes sure to remove the protocol
      // before forwarding it to TS, and to add it back on all returned paths.

      function addZipPrefix(str) {
        // We add the \`zip:\` prefix to both \`.zip/\` paths and virtual paths
        if (isAbsolute(str) && !str.match(/^\\^zip:/) && (str.match(/\\.zip\\//) || str.match(/\\$\\$virtual\\//))) {
          // Absolute VSCode \`Uri.fsPath\`s need to start with a slash.
          // VSCode only adds it automatically for supported schemes,
          // so we have to do it manually for the \`zip\` scheme.
          // The path needs to start with a caret otherwise VSCode doesn't handle the protocol
          // https://github.com/microsoft/vscode/issues/105014#issuecomment-686760910
          return \`\${isVSCode ? '^' : ''}zip:\${str.replace(/^\\/?/, \`/\`)}\`;
        } else {
          return str;
        }
      }

      function removeZipPrefix(str) {
        return process.platform === \`win32\`
          ? str.replace(/^\\^?zip:\\//, \`\`)
          : str.replace(/^\\^?zip:/, \`\`);
      }

      // We also downgrade virtual paths into regular ones before returning
      // them so that ctrl+click sends us to the expected locations rather
      // than virtual images (which would mess with file watching etc).
      //
      // Implementation copied from VirtualFS.ts; try to make sure they are
      // kept in sync!

      const NUMBER_REGEXP = /^[0-9]+$/;
      const VIRTUAL_REGEXP = /^(\\/(?:[^/]+\\/)*?\\$\\$virtual)((?:\\/((?:[^/]+-)?[a-f0-9]+)(?:\\/([^/]+))?)?((?:\\/.*)?))$/;

      function resolveVirtual(p: PortablePath): PortablePath {
        const match = p.match(VIRTUAL_REGEXP);
        if (!match || (!match[3] && match[5]))
          return p;

        const target = dirname(match[1]);
        if (!match[3] || !match[4])
          return target;

        const isnum = NUMBER_REGEXP.test(match[4]);
        if (!isnum)
          return p;

        const depth = Number(match[4]);
        const backstep = \`../\`.repeat(depth);
        const subpath = (match[5] || \`.\`);

        return VirtualFS.resolveVirtual(join(target, backstep, subpath));
      }

      // And here is the point where we hijack the VSCode <-> TS communications
      // by adding ourselves in the middle. We locate everything that looks
      // like an absolute path of ours and normalize it.

      const Session = tsserver.server.Session;
      const {onMessage: originalOnMessage, send: originalSend} = Session.prototype;
      let isVSCode = false;

      return Object.assign(Session.prototype, {
        onMessage(/** @type {string} */ message) {
          const parsedMessage = JSON.parse(message)

          if (
            parsedMessage != null &&
            typeof parsedMessage === \`object\` &&
            parsedMessage.arguments &&
            parsedMessage.arguments.hostInfo === \`vscode\`
          ) {
            isVSCode = true;
          }

          return originalOnMessage.call(this, JSON.stringify(parsedMessage, (key, value) => {
            return typeof value === \`string\` ? removeZipPrefix(value) : value;
          }));
        },

        send(/** @type {any} */ msg) {
          return originalSend.call(this, JSON.parse(JSON.stringify(msg, (key, value) => {
            return typeof value === \`string\` ? addZipPrefix(value) : value;
          })));
        }
      });
    };
  `;

  const wrapper = new Wrapper(`typescript` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/tsc` as PortablePath);
  await wrapper.writeBinary(`bin/tsserver` as PortablePath);

  await wrapper.writeFile(`lib/tsc.js` as PortablePath);
  await wrapper.writeFile(`lib/tsserver.js` as PortablePath, {wrapModule: tsServerMonkeyPatch});
  await wrapper.writeFile(`lib/typescript.js` as PortablePath);

  return wrapper;
};

export const generateStylelintBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`stylelint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/stylelint.js` as PortablePath);
  await wrapper.writeFile(`lib/index.js` as PortablePath);

  return wrapper;
};

export const generateSvelteLanguageServerBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`svelte-language-server` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/server.js` as PortablePath);

  return wrapper;
};

export const generateFlowBinBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`flow-bin` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`cli.js` as PortablePath);

  return wrapper;
};

export const BASE_SDKS: BaseSdks = [
  [`eslint`, generateEslintBaseWrapper],
  [`prettier`, generatePrettierBaseWrapper],
  [`typescript-language-server`, generateTypescriptLanguageServerBaseWrapper],
  [`typescript`, generateTypescriptBaseWrapper],
  [`stylelint`, generateStylelintBaseWrapper],
  [`svelte-language-server`, generateSvelteLanguageServerBaseWrapper],
  [`flow-bin`, generateFlowBinBaseWrapper],
];
