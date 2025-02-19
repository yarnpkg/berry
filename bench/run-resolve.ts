
import * as fs from 'fs'
import { performance } from 'perf_hooks';
import { ZipFS } from '@yarnpkg/libzip';
import { MiniZipFS } from '@yarnpkg/minizip';
import { PortablePath } from '@yarnpkg/fslib';
import {createRequire} from 'module'
import path from 'path'
import {ResolverFactory} from 'enhanced-resolve'



const formatMemoryUsage = (data: number) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

const from = require.resolve('micromatch');
// const baseFs= new ZipFS(from as PortablePath)
// const resolver = ResolverFactory.createResolver({fileSystem: {readFile: baseFs.readFileSync.bind(baseFs)}})
console.log(from)
const req = createRequire(path.dirname(from))

globalThis.Error = class {
  constructor() {}
  static captureStackTrace = () => {}
}


const was = performance.now()
for (let i = 0; i < 50_000; i++) {
  // resolver.resolveSync({}, from, `./fi${i}`)
  try {
    req.resolve(`./file${i}`)
  } catch {

  }
}
console.log(performance.now() - was)
