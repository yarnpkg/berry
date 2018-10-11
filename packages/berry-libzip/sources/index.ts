import libzip = require('./libzip');

// @ts-ignore
// const libzipFs: typeof FS = libzip.FS;

// @ts-ignore
// const nodeFs: typeof NODEFS = libzipFs.filesystems.NODEFS;

//libzipFs.mkdir('/mnt');
//libzipFs.mount(nodeFs, {root: '/'}, '/mnt');

export default {
  // Those are getters because they can change after memory growth
  get HEAP8() { return libzip.HEAP8 },
  get HEAPU8() { return libzip.HEAPU8 },

  malloc: libzip._malloc,
  free: libzip._free,

  getValue: libzip.getValue,

  open: libzip.cwrap('zip_open', 'number', ['string', 'number', 'number']),

  getError: libzip.cwrap('zip_get_error', 'number', ['number']),
  getName: libzip.cwrap('zip_get_name', 'string', ['number', 'number', 'number']),
  getNumEntries: libzip.cwrap('zip_get_num_entries', 'number', ['number', 'number']),

  stat: libzip.cwrap('zip_stat', 'number', ['number', 'string', 'number', 'number']),
  statIndex: libzip.cwrap('zip_stat_index', 'number', ['number', 'number', 'number', 'number', 'number']),

  fopen: libzip.cwrap('zip_fopen', 'number', ['number', 'string', 'number']),
  fopenIndex: libzip.cwrap('zip_fopen_index', 'number', ['number', 'number', 'number', 'number']),

  fread: libzip.cwrap('zip_fread', 'number', ['number', 'number', 'number', 'number']),
  fclose: libzip.cwrap('zip_fclose', 'number', ['number']),

  file: {
    getError: libzip.cwrap('zip_file_get_error', 'number', ['number']),
  },

  error: {
    initWithCode: libzip.cwrap('zip_error_init_with_code', 'void', ['number', 'number']),
    strerror: libzip.cwrap('zip_error_strerror', 'string', ['number']),
  },

  struct: {
    stat: libzip.cwrap('zipstruct_stat', 'number', []),
    statS: libzip.cwrap('zipstruct_statS', 'number', []),
    statName: libzip.cwrap('zipstruct_stat_name', 'string', ['number']),
    statIndex: libzip.cwrap('zipstruct_stat_index', 'number', ['number']),
    statSize: libzip.cwrap('zipstruct_stat_size', 'number', ['number']),
    statMtime: libzip.cwrap('zipstruct_stat_mtime', 'number', ['number']),

    error: libzip.cwrap('zipstruct_error', 'number', []),
    errorS: libzip.cwrap('zipstruct_errorS', 'number', []),
  },
};
