const path = require(`path`);

const {getPatch} = require(path.resolve(process.argv[2], process.argv[3]));
process.stdout.write(getPatch());
