let cwd = `/`;

const eventLoop = new Set();
let eventLoopCheck;

function scheduleCheck() {
  if (eventLoopCheck)
    return;

  eventLoopCheck = setTimeout(() => {
    eventLoopCheck = null;
    if (eventLoop.size === 0) {
      console.log(`ended`);
    }
  });
}

module.exports = {
  argv: [],
  chdir: newCwd => {
    cwd = newCwd;
  },
  cwd: () => cwd,
  env: {
    TMPDIR: `/tmp`,
  },
  setTimeout: (cb, duration) => {
    const wrapper = () => {
      eventLoop.delete(timer);
      if (eventLoop.size === 0)
        scheduleCheck();

      cb();
    };

    const id = setTimeout(wrapper, duration);

    const timer = {
      cancel: () => {
        clearTimeout(id);
      },
      unref: () => {
        eventLoop.delete(timer);
        if (eventLoop.size === 0) {
          scheduleCheck();
        }
      },
    };

    eventLoop.add(timer);
    return timer;
  },
  clearTimeout: timer => {
    timer.cancel();
  },
  nextTick: (cb, ...args) => {
    Promise.resolve().then(() => {
      cb(...args);
    });
  },
  once: () => {

  },
  platform: `linux`,
  versions: {node: `v14.15.0`},
  version: `14.15.0`,
};

const {PassThrough} = require(`stream`);

module.exports.stdin = new PassThrough();
module.exports.stdout = new PassThrough();
module.exports.stderr = new PassThrough();
