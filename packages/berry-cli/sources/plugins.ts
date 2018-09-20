// @ts-ignore
import embedPlugins = require('./plugins-embed.js');

import {Plugin} from '@berry/core';

export const plugins: Map<string, Plugin> = embedPlugins;
