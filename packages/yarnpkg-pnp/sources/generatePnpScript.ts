import {Filename}                from '@yarnpkg/fslib';

import {generatePrettyJson}      from './generatePrettyJson';
import {generateSerializedState} from './generateSerializedState';
import getTemplate               from './hook';
import {SerializedState}         from './types';
import {PnpSettings}             from './types';

export function generateLoader(shebang: string | null | undefined, loader: string) {
  return [
    shebang ? `${shebang}\n` : ``,
    `/* eslint-disable */\n`,
    `// @ts-nocheck\n`,
    `"use strict";\n`,
    `\n`,
    loader,
    `\n`,
    getTemplate(),
  ].join(``);
}

function generateJsonString(data: SerializedState) {
  return JSON.stringify(data, null, 2);
}

function generateStringLiteral(value: string) {
  return `'${
    value
      .replace(/\\/g, `\\\\`)
      .replace(/'/g, `\\'`)
      .replace(/\n/g, `\\\n`)
  }'`;
}

function generateInlinedSetup(data: SerializedState) {
  return [
    `const RAW_RUNTIME_STATE =\n`,
    `${generateStringLiteral(generatePrettyJson(data))};\n\n`,
    `function $$SETUP_STATE(hydrateRuntimeState, basePath) {\n`,
    `  return hydrateRuntimeState(JSON.parse(RAW_RUNTIME_STATE), {basePath: basePath || __dirname});\n`,
    `}\n`,
  ].join(``);
}

function generateSplitSetup() {
  return [
    `function $$SETUP_STATE(hydrateRuntimeState, basePath) {\n`,
    `  const fs = require('fs');\n`,
    `  const path = require('path');\n`,
    `  const pnpDataFilepath = path.resolve(__dirname, ${JSON.stringify(Filename.pnpData)});\n`,
    `  return hydrateRuntimeState(JSON.parse(fs.readFileSync(pnpDataFilepath, 'utf8')), {basePath: basePath || __dirname});\n`,
    `}\n`,
  ].join(``);
}

export function generateInlinedScript(settings: PnpSettings): string {
  const data = generateSerializedState(settings);

  const setup = generateInlinedSetup(data);
  const loaderFile = generateLoader(settings.shebang, setup);

  return loaderFile;
}

export function generateSplitScript(settings: PnpSettings): {dataFile: string, loaderFile: string} {
  const data = generateSerializedState(settings);

  const setup = generateSplitSetup();
  const loaderFile = generateLoader(settings.shebang, setup);

  return {dataFile: generateJsonString(data), loaderFile};
}
