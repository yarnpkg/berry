const {Volume} = require(`memfs`);

Volume.fd = 3;

function resetVolume(content) {
  const volume = Volume.fromJSON(content);

  volume.newFdNumber = function () {
    const releasedFd = this.releasedFds.pop();
    return typeof releasedFd === `number` ? releasedFd : Volume.fd++;
  };

  for (const key in volume)
    if (typeof volume[key] === `function`)
      module.exports[key] = volume[key].bind(volume);

  module.exports.constants = require(`memfs/lib/constants`).constants;
  module.exports.resetVolume = resetVolume;
  module.exports.serializeVolume = () => volume.toJSON();
  module.exports.writev = () => {
    throw new Error(`Unimplemented method writev`);
  };

  return module.exports;
}

resetVolume();
