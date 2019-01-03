import {Plugin}     from '@berry/core';

// @ts-ignore
import embedPlugins from './plugins-embed.js';

export const plugins: Map<string, Plugin> = embedPlugins;
