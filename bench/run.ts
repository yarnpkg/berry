
import * as fs from 'fs'
import { performance } from 'perf_hooks';
import { ZipFS } from '@yarnpkg/libzip';
import { MiniZipFS } from '@yarnpkg/minizip';
import { PortablePath } from '@yarnpkg/fslib';





const cwd = '/Users/vadymh/.yarn/berry/cache';
const files = fs.readdirSync(cwd).filter(f => f.endsWith('.zip'))

let totalSize = 0
for (const f of files) {
  const file = `${cwd}/${f}`;
  const stats = fs.statSync(file)
  totalSize += stats.size
}


const formatMemoryUsage = (data: number) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

console.log('files count: ' + files.length, 'size', formatMemoryUsage(totalSize))



for (const zipper of [MiniZipFS, ZipFS]) {
  for (let i = 0; i < 3; i++) {
    let allFiles = 0
    const was = performance.now()

    for (const f of files) {
      const file = `${cwd}/${f}`;

      let fi = new zipper(file as PortablePath)
      allFiles += fi.getAllFiles().length

      fi.discardAndClose()
    }
    const memoryData = process.memoryUsage();

    const memoryUsage = {
      rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
      heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
      heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
      external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    };
    console.log(`${zipper.name}: try ${i + 1}, ${performance.now() - was} ms, ${allFiles}`)
    console.log(memoryUsage)
  }
}





