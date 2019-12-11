import {FakeFS}                        from './FakeFS';
import {NodeFS}                        from './NodeFS';
import {ProxiedFS}                     from './ProxiedFS';
import {Filename, PortablePath, ppath} from './path';

const NUMBER_REGEXP = /^[0-9]+$/;

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
const escapeRegexp = (s: string) => s.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');

export type VirtualFSOptions = {
  baseFs?: FakeFS<PortablePath>,
  folderName?: Filename,
};

export class VirtualFS extends ProxiedFS<PortablePath, PortablePath> {
  protected readonly baseFs: FakeFS<PortablePath>;

  private readonly target: PortablePath;
  private readonly virtual: PortablePath;

  private readonly mapToBaseRegExp: RegExp;

  static makeVirtualPath(base: PortablePath, component: Filename, to: PortablePath) {
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

  constructor(virtual: PortablePath, {baseFs = new NodeFS()}: VirtualFSOptions = {}) {
    super(ppath);

    this.baseFs = baseFs;

    this.target = ppath.dirname(virtual);
    this.virtual = virtual;

    // $0: full path
    // $1: virtual folder
    // $2: virtual segment
    // $3: hash
    // $4: depth
    // $5: subpath
    this.mapToBaseRegExp = new RegExp(`^(${escapeRegexp(this.virtual)})((?:/([^\/]+)(?:/([^/]+))?)?((?:/.*)?))$`);
  }

  getRealPath() {
    return this.pathUtils.resolve(this.baseFs.getRealPath(), this.target);
  }

  realpathSync(p: PortablePath) {
    const match = p.match(this.mapToBaseRegExp);
    if (!match)
      return this.baseFs.realpathSync(p);

    if (!match[5])
      return p;

    const realpath = this.baseFs.realpathSync(this.mapToBase(p));
    return VirtualFS.makeVirtualPath(this.virtual, match[3] as Filename, realpath);
  }

  async realpathPromise(p: PortablePath) {
    const match = p.match(this.mapToBaseRegExp);
    if (!match)
      return await this.baseFs.realpathPromise(p);

    if (!match[5])
      return p;

    const realpath = await this.baseFs.realpathPromise(this.mapToBase(p));
    return VirtualFS.makeVirtualPath(this.virtual, match[3] as Filename, realpath);
  }

  mapToBase(p: PortablePath): PortablePath {
    const match = p.match(this.mapToBaseRegExp);
    if (!match)
      return p;

    if (!match[3] || !match[4])
      return this.target;

    const isnum = NUMBER_REGEXP.test(match[4]);
    if (!isnum)
      return p;

    const depth = Number(match[4]);
    const backstep = `../`.repeat(depth) as PortablePath;
    const subpath = (match[5] || `.`) as PortablePath;

    return this.mapToBase(ppath.join(this.target, backstep, subpath));
  }

  mapFromBase(p: PortablePath) {
    return p;
  }
}
