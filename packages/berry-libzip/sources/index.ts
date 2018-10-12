import libzip = require('./libzip');

const number64 = [
  'number', // low
  'number', // high
];

export default {
  // Those are getters because they can change after memory growth
  get HEAP8() { return libzip.HEAP8 },
  get HEAPU8() { return libzip.HEAPU8 },

  ZIP_CHECKCONS: 4,
  ZIP_CREATE: 1,
  ZIP_EXCL: 2,
  ZIP_TRUNCATE: 8,
  ZIP_RDONLY: 16,

  ZIP_FL_OVERWRITE: 8192,

  malloc: libzip._malloc,
  free: libzip._free,

  getValue: libzip.getValue,

  open: libzip.cwrap('zip_open', 'number', ['string', 'number', 'number']),
  close: libzip.cwrap('zip_close', 'number', ['number']),
  discard: libzip.cwrap('zip_discard', 'void', ['number']),

  getError: libzip.cwrap('zip_get_error', 'number', ['number']),
  getName: libzip.cwrap('zip_get_name', 'string', ['number', 'number', 'number']),
  getNumEntries: libzip.cwrap('zip_get_num_entries', 'number', ['number', 'number']),

  stat: libzip.cwrap('zip_stat', 'number', ['number', 'string', 'number', 'number']),
  statIndex: libzip.cwrap('zip_stat_index', 'number', ['number', ...number64, 'number', 'number']),

  fopen: libzip.cwrap('zip_fopen', 'number', ['number', 'string', 'number']),
  fopenIndex: libzip.cwrap('zip_fopen_index', 'number', ['number', ...number64, 'number']),

  fread: libzip.cwrap('zip_fread', 'number', ['number', 'number', 'number', 'number']),
  fclose: libzip.cwrap('zip_fclose', 'number', ['number']),

  dir: {
    add: libzip.cwrap('zip_dir_add', 'number', ['number', 'string']),
  },

  file: {
    add: libzip.cwrap('zip_file_add', 'number', ['number', 'string', 'number', 'number']),
    getError: libzip.cwrap('zip_file_get_error', 'number', ['number']),
  },

  error: {
    initWithCode: libzip.cwrap('zip_error_init_with_code', 'void', ['number', 'number']),
    strerror: libzip.cwrap('zip_error_strerror', 'string', ['number']),
  },

  source: {
    fromBuffer: libzip.cwrap('zip_source_buffer', 'number', ['number', 'number', ...number64, 'number']),
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
