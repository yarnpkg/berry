const {Terminal} = require(`xterm-headless`);
const {SerializeAddon} = require(`xterm-addon-serialize`);

module.exports = function (content) {
  const callback = this.async();

  const terminal = new Terminal({
    allowProposedApi: true,
    convertEol: true,
    cols: 200,
  });

  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);

  terminal.write(content, () => {
    const serialized = serializeAddon.serializeAsHTML()
      // We don't care about the HTML wrapper
      .replace(/.*<!--StartFragment--><pre>|<\/pre><!--EndFragment-->.*/g, ``)
      // https://github.com/xtermjs/xterm.js/pull/4833
      .replace(/color: ([a-f0-9]{6})/g, `color: #$1`)
      .replace(/<div style=[^>]+>/, `<div>`)
      // Removes the trailing columns
      .replace(/ *(<\/span><\/div>)/g, `$1`)
      // Removes the trailing lines
      .replace(/(<div><span> *<\/span><\/div>)+(?=<\/div>$)/, ``);

    terminal.dispose();

    callback(null, `module.exports = ${JSON.stringify(serialized)};`);
  });
};
