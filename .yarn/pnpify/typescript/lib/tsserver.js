#!/usr/bin/env node

const {existsSync} = require(`fs`);
const {createRequire, createRequireFromPath} = require(`module`);
const {resolve} = require(`path`);

const relPnpApiPath = "../../../../.pnp.js";

const absPnpApiPath = resolve(__dirname, relPnpApiPath);
const absRequire = (createRequire || createRequireFromPath)(absPnpApiPath);

const moduleWrapper = tsserver => {
  // VSCode sends the zip paths to TS using the "zip://" prefix, that TS
  // doesn't understand. This layer makes sure to remove the protocol
  // before forwarding it to TS, and to add it back on all returned paths.

  const {isAbsolute} = require(`path`);

  const Session = tsserver.server.Session;
  const {onMessage: originalOnMessage, send: originalSend} = Session.prototype;

  return Object.assign(Session.prototype, {
    onMessage(/** @type {string} */ message) {
      return originalOnMessage.call(this, JSON.stringify(JSON.parse(message), (key, value) => {
        return typeof value === 'string' ? removeZipPrefix(value) : value;
      }));
    },

    send(/** @type {any} */ msg) {
      return originalSend.call(this, JSON.parse(JSON.stringify(msg, (key, value) => {
        return typeof value === 'string' ? addZipPrefix(value) : value;
      })));
    }
  });

  function addZipPrefix(str) {
    if (isAbsolute(str) && str.match(/\.zip\//) && !str.match(/^zip:/)) {
      return `zip:${str}`;
    } else {
      return str;
    }
  }

  function removeZipPrefix(str) {
    return str.replace(/^zip:/, ``);
  }
};

if (existsSync(absPnpApiPath)) {
  if (!process.versions.pnp) {
    // Setup the environment to be able to require typescript/lib/tsserver.js
    require(absPnpApiPath).setup();
  }
}

// Defer to the real typescript/lib/tsserver.js your application uses
module.exports = moduleWrapper(absRequire(`typescript/lib/tsserver.js`));
