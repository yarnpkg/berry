const {NodeFS} = require('@yarnpkg/fslib');

module.exports = NodeFS.toPortablePath(__dirname);
