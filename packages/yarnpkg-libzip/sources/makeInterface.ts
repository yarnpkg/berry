const number64 = [
  `number`, // low
  `number`, // high
] as Array<'number'>;

export type Libzip = ReturnType<typeof makeInterface>;

export const makeInterface = (libzip: EmscriptenModule) => ({
  // Those are getters because they can change after memory growth
  get HEAP8() { return libzip.HEAP8; },
  get HEAPU8() { return libzip.HEAPU8; },

  SEEK_SET: 0,
  SEEK_CUR: 1,
  SEEK_END: 2,

  ZIP_CHECKCONS: 4,
  ZIP_CREATE: 1,
  ZIP_EXCL: 2,
  ZIP_TRUNCATE: 8,
  ZIP_RDONLY: 16,

  ZIP_FL_OVERWRITE: 8192,

  ZIP_OPSYS_DOS: 0x00,
  ZIP_OPSYS_AMIGA: 0x01,
  ZIP_OPSYS_OPENVMS: 0x02,
  ZIP_OPSYS_UNIX: 0x03,
  ZIP_OPSYS_VM_CMS: 0x04,
  ZIP_OPSYS_ATARI_ST: 0x05,
  ZIP_OPSYS_OS_2: 0x06,
  ZIP_OPSYS_MACINTOSH: 0x07,
  ZIP_OPSYS_Z_SYSTEM: 0x08,
  ZIP_OPSYS_CPM: 0x09,
  ZIP_OPSYS_WINDOWS_NTFS: 0x0a,
  ZIP_OPSYS_MVS: 0x0b,
  ZIP_OPSYS_VSE: 0x0c,
  ZIP_OPSYS_ACORN_RISC: 0x0d,
  ZIP_OPSYS_VFAT: 0x0e,
  ZIP_OPSYS_ALTERNATE_MVS: 0x0f,
  ZIP_OPSYS_BEOS: 0x10,
  ZIP_OPSYS_TANDEM: 0x11,
  ZIP_OPSYS_OS_400: 0x12,
  ZIP_OPSYS_OS_X: 0x13,

  ZIP_CM_DEFAULT: -1,
  ZIP_CM_STORE: 0,
  ZIP_CM_DEFLATE: 8,

  uint08S: libzip._malloc(1),
  uint16S: libzip._malloc(2),
  uint32S: libzip._malloc(4),
  uint64S: libzip._malloc(8),

  malloc: libzip._malloc,
  free: libzip._free,

  getValue: libzip.getValue,

  open: libzip.cwrap(`zip_open`, `number`, [`string`, `number`, `number`]),
  openFromSource: libzip.cwrap(`zip_open_from_source`, `number`, [`number`, `number`, `number`]),
  close: libzip.cwrap(`zip_close`, `number`, [`number`]),
  discard: libzip.cwrap(`zip_discard`, null, [`number`]),

  getError: libzip.cwrap(`zip_get_error`, `number`, [`number`]),
  getName: libzip.cwrap(`zip_get_name`, `string`, [`number`, `number`, `number`]),
  getNumEntries: libzip.cwrap(`zip_get_num_entries`, `number`, [`number`, `number`]),

  stat: libzip.cwrap(`zip_stat`, `number`, [`number`, `string`, `number`, `number`]),
  statIndex: libzip.cwrap(`zip_stat_index`, `number`, [`number`, ...number64, `number`, `number`]),

  fopen: libzip.cwrap(`zip_fopen`, `number`, [`number`, `string`, `number`]),
  fopenIndex: libzip.cwrap(`zip_fopen_index`, `number`, [`number`, ...number64, `number`]),

  fread: libzip.cwrap(`zip_fread`, `number`, [`number`, `number`, `number`, `number`]),
  fclose: libzip.cwrap(`zip_fclose`, `number`, [`number`]),

  dir: {
    add: libzip.cwrap(`zip_dir_add`, `number`, [`number`, `string`]),
  },

  file: {
    add: libzip.cwrap(`zip_file_add`, `number`, [`number`, `string`, `number`, `number`]),
    getError: libzip.cwrap(`zip_file_get_error`, `number`, [`number`]),
    getExternalAttributes: libzip.cwrap(`zip_file_get_external_attributes`, `number`, [`number`, ...number64, `number`, `number`, `number`]),
    setExternalAttributes: libzip.cwrap(`zip_file_set_external_attributes`, `number`, [`number`, ...number64, `number`, `number`, `number`]),
    setMtime: libzip.cwrap(`zip_file_set_mtime`, `number`, [`number`, ...number64, `number`, `number`]),
    setCompression: libzip.cwrap(`zip_set_file_compression`, `number`, [`number`, ...number64, `number`, `number`]),
  },

  error: {
    initWithCode: libzip.cwrap(`zip_error_init_with_code`, null, [`number`, `number`]),
    strerror: libzip.cwrap(`zip_error_strerror`, `string`, [`number`]),
  },

  name: {
    locate: libzip.cwrap(`zip_name_locate`, `number`, [`number`, `string`, `number`]),
  },

  source: {
    fromUnattachedBuffer: libzip.cwrap(`zip_source_buffer_create`, `number`, [`number`, `number`, `number`, `number`]),
    fromBuffer: libzip.cwrap(`zip_source_buffer`, `number`, [`number`, `number`, ...number64, `number`]),
    free: libzip.cwrap(`zip_source_free`, null, [`number`]),
    keep: libzip.cwrap(`zip_source_keep`, null, [`number`]),
    open: libzip.cwrap(`zip_source_open`, `number`, [`number`]),
    close: libzip.cwrap(`zip_source_close`, `number`, [`number`]),
    seek: libzip.cwrap(`zip_source_seek`, `number`, [`number`, ...number64, `number`]),
    tell: libzip.cwrap(`zip_source_tell`, `number`, [`number`]),
    read: libzip.cwrap(`zip_source_read`, `number`, [`number`, `number`, `number`]),
    error: libzip.cwrap(`zip_source_error`, `number`, [`number`]),
    setMtime: libzip.cwrap(`zip_source_set_mtime`, `number`, [`number`, `number`]),
  },

  struct: {
    stat: libzip.cwrap(`zipstruct_stat`, `number`, []),
    statS: libzip.cwrap(`zipstruct_statS`, `number`, []),
    statName: libzip.cwrap(`zipstruct_stat_name`, `string`, [`number`]),
    statIndex: libzip.cwrap(`zipstruct_stat_index`, `number`, [`number`]),
    statSize: libzip.cwrap(`zipstruct_stat_size`, `number`, [`number`]),
    statMtime: libzip.cwrap(`zipstruct_stat_mtime`, `number`, [`number`]),

    error: libzip.cwrap(`zipstruct_error`, `number`, []),
    errorS: libzip.cwrap(`zipstruct_errorS`, `number`, []),
  },
});
