import {FakeFS}                        from './FakeFS';
import {NodeFS}                        from './NodeFS';
import {ProxiedFS}                     from './ProxiedFS';
import {Filename, PortablePath, ppath} from './path';

const NUMBER_REGEXP = /^[0-9]+$/;

// $0: full path
// $1: virtual folder
// $2: virtual segment
// $3: hash
// $4: depth
// $5: subpath
const VIRTUAL_REGEXP = /^(\/(?:[^\/]+\/)*?\$\$virtual)((?:\/([^\/]+)(?:\/([^\/]+))?)?((?:\/.*)?))$/;

export type VirtualFSOptions = {
  baseFs?: FakeFS<PortablePath>,
  folderName?: Filename,
};

export class VirtualFS extends ProxiedFS<PortablePath, PortablePath> {
  protected readonly baseFs: FakeFS<PortablePath>;

  static makeVirtualPath(base: PortablePath, component: Filename, to: PortablePath) {
    if (ppath.basename(base) !== `$$virtual`)
      throw new Error(`Assertion failed: Virtual folders must be named "$$virtual"`);

    // Obtains the relative distance between the virtual path and its actual target
    const target = ppath.relative(ppath.dirname(base), to);
    const segments = target.split(`/`);

    // Counts how many levels we need to go back to start applying the rest of the path
    let depth = 0;
    while (depth < segments.length && segments[depth] === `..`)
      depth += 1;

    const finalSegments = segments.slice(depth) as Array<Filename>;
    const fullVirtualPath = ppath.join(base, component, String(depth) as Filename, ...finalSegments);

    return fullVirtualPath;
  }

  static resolveVirtual(p: PortablePath): PortablePath {
    const match = p.match(VIRTUAL_REGEXP);
    if (!match)
      return p;

    const target = ppath.dirname(match[1] as PortablePath);
    if (!match[3] || !match[4])
      return target;

    const isnum = NUMBER_REGEXP.test(match[4]);
    if (!isnum)
      return p;

    const depth = Number(match[4]);
    const backstep = `../`.repeat(depth) as PortablePath;
    const subpath = (match[5] || `.`) as PortablePath;

    return VirtualFS.resolveVirtual(ppath.join(target, backstep, subpath));
  }

  constructor({baseFs = new NodeFS()}: VirtualFSOptions = {}) {
    super(ppath);

    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  realpathSync(p: PortablePath) {
    const match = p.match(VIRTUAL_REGEXP);
    if (!match)
      return this.baseFs.realpathSync(p);

    if (!match[5])
      return p;

    const realpath = this.baseFs.realpathSync(this.mapToBase(p));
    return VirtualFS.makeVirtualPath(match[1] as PortablePath, match[3] as Filename, realpath);
  }

  async realpathPromise(p: PortablePath) {
    const match = p.match(VIRTUAL_REGEXP);
    if (!match)
      return await this.baseFs.realpathPromise(p);

    if (!match[5])
      return p;

    const realpath = await this.baseFs.realpathPromise(this.mapToBase(p));
    return VirtualFS.makeVirtualPath(match[1] as PortablePath, match[3] as Filename, realpath);
  }

  mapToBase(p: PortablePath): PortablePath {
    return VirtualFS.resolveVirtual(p);
  }

  mapFromBase(p: PortablePath) {
    return p;
  }
}
