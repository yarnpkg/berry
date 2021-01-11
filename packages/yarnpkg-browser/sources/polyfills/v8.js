const {stringify, parse} = require(`granola`);

module.exports = {
  serialize: data => Buffer.from(stringify(data)),
  parse: buffer => parse(buffer.toString()),
};
