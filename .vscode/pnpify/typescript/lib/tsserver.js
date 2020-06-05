#!/usr/bin/env node

const { existsSync } = require(`fs`);
const { createRequire, createRequireFromPath } = require(`module`);
const { resolve } = require(`path`);
const fs = require("fs");

const relPnpApiPath = "../../../../.pnp.js";

const absPnpApiPath = resolve(__dirname, relPnpApiPath);
const absRequire = (createRequire || createRequireFromPath)(absPnpApiPath);

const moduleWrapper = function (tsserverOrLib) {
  const Session = tsserverOrLib.server.Session;
  const {
    onMessage: originalOnMessage,
    send: originalSend,
  } = Session.prototype;
  Object.assign(Session.prototype, {
    onMessage(/** @type {string} */ message) {
      let processed = message;
      try {
        const parsed = JSON.parse(message);
        // process the message
        processed = JSON.stringify(parsed, (key, value) => {
          if (typeof value === "string") {
            // strip the zip:// prefix from paths
            return removeZipPrefix(value);
          }
          return value;
        });
      } catch (e) {
        // we failed to parse and process the message
        // pass it verbatim
        throw e;
      }
      return originalOnMessage.call(this, processed);
      // return originalOnMessage.call(this, message);
    },
    /** msg is an object that will be formatted / stringified */
    send(msg) {
      let processed = msg;
      try {
        // transform it
        processed = JSON.parse(
          JSON.stringify(msg, (key, value) => {
            if (typeof value === "string") {
              return addZipPrefix(value);
            }
            return value;
          })
        );
      } catch (e) {
        // we failed to process; pass it verbatim
        throw e;
      }
      return originalSend.call(this, processed);
      // return originalSend.call(this, msg);
    },
  });

  function addZipPrefix(str) {
    if (str.match(/.zip\//) && !str.match(/^zip:\/\//)) {
      return `zip:${str}`;
    }
    return str;
  }
  function removeZipPrefix(str) {
    return str.replace(/^zip:\/\//, '');
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
