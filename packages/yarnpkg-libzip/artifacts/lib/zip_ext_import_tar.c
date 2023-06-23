#include <string.h>
#include <zip.h>

/**
 * Unix timestamp for `1984-06-22T21:50:00.000Z`
 *
 * It needs to be after 1980-01-01 because that's what Zip supports, and it
 * needs to have a slight offset to account for different timezones (because
 * zip assumes that all times are local to whoever writes the file, which is
 * really silly).
 */
static zip_uint32_t SAFE_TIME = 456789000;

struct tar_header {
  char name[100];
  char mode[8];
  char uid[8];
  char gid[8];
  char size[12];
  char mtime[12];
  char chksum[8];
  char typeflag;
  char linkname[100];

  // ustar
  char ustar[6];
  char ustar_version[2];
  char ustar_username[32];
  char ustar_groupname[32];
  char ustar_devmajor[8];
  char ustar_devminor[8];
  char ustar_prefix[155];
};

static zip_int16_t process_name_segment(
  char* destination,
  zip_uint16_t destination_max_index,

  char const* segment,
  zip_uint8_t segment_max_index,

  zip_uint8_t* skip_depth,
  zip_uint8_t* state
) {
  zip_int32_t index = 0;

  // We also ignore paths that could lead to escaping outside the archive
  for (zip_uint8_t t = 0; t < segment_max_index; ++t) {
    char c = segment[t];
    if (c == 0)
      break;

    switch (segment[t]) {
      case '.': {
        if (*state == 1) {
          *state = 2;
        } else if (*state == 2) {
          *state = 3;
        } else if (*state == 3) {
          *state = 0;
          if (*skip_depth == 0) {
            // Sounds weird but safe; we can add the dots we buffered
            destination[index++] = '.';
            destination[index++] = '.';
            destination[index++] = '.';
          } else if (skip_depth) {
            destination[index++] = '.';
          }
        }
      } break;

      case '/': {
        if (*state == 0) {
          if (*skip_depth == 0) {
            // We can add the slash we buffered
            destination[index++] = '/';
          } else {
            *skip_depth -= 1;
          }
          *state = 1;
        } else if (*state == 2) {
          // "/./" detected; skipping it
          *state = 1;
          continue;
        } else if (*state == 3) {
          // "/../" detected; bad path
          return -1;
        }
      } break;

      default: {
        if (*skip_depth == 0)
          destination[index++] = c;

        *state = 0;
      } break;
    }
  }

  return index;
}

static char normalize_name(
  char* destination,
  zip_uint16_t destination_max_index,

  char const* prefix,
  char const* name,

  zip_uint8_t skip_depth
) {
  // Disallow absolute paths; might be malicious (ex: /etc/passwd)
  if (prefix[0] == '/' || prefix[0] == 0 && name[0] == '/')
    return -1;

  zip_uint8_t state = 1;

  zip_int16_t prefix_len = process_name_segment(
    destination,
    destination_max_index - 1,

    prefix,
    155,

    &skip_depth,
    &state
  );

  if (prefix_len < 0)
    return -1;

  zip_int16_t name_len = process_name_segment(
    destination + prefix_len,
    destination_max_index - prefix_len - 1,

    name,
    100,

    &skip_depth,
    &state
  );

  if (name_len < 0)
    return -1;

  // "/." or "/.." detected
  if (state == 2 || state == 3)
    return -1;

  // Not deep enough
  if (skip_depth > 0)
    return -1;

  destination[prefix_len + name_len] = 0;

  // Note: we allow trailing slashes, they are usually directories
  return 0;
}

zip_int64_t zip_ext_import_tar(zip_t* za, unsigned char *tar, zip_uint64_t tar_size, zip_uint8_t skip_depth, char const* prefix_path)
{
  // We don't support gzipped tarballs
  if (tar[0] == 0x1f && tar[1] == 0x8b) {
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  // Since the execution is synchronous, we don't need to allocate a buffer,
  // we can just reuse a static one.
  static char normalized_name[512];

  // We inject the prefix path into the name buffer, then we retrieve the
  // amount of remaining space. The
  int prefix_path_len = strlen(prefix_path);

  // Since the ustar file names can be 100 + 155 bytes long, the prefix path
  // can only be 129 - 2 bytes long (we reserve two bytes: one for the trailing
  // slash for directories, and the other for the trailing \0).
  if (prefix_path_len > 127) {
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  memcpy(normalized_name, prefix_path, prefix_path_len);
  char* name_target = &normalized_name[prefix_path_len];

  // We reserve two bytes: one for the trailing \0, and another one for the
  // trailing "/" if the path is a directory.
  zip_uint16_t name_target_max_index = sizeof(normalized_name) - prefix_path_len;

  for (zip_uint64_t offset = 0; offset < tar_size;) {
    struct tar_header* header = (struct tar_header*)(tar + offset);
    if (header->name[0] == '\0') {
      break;
    }

    zip_int16_t name_len = normalize_name(name_target, name_target_max_index, header->ustar_prefix, header->name, skip_depth);
    if (name_len <= 0) {
      continue;
    }

    // We make sure that all directory names end with a trailing slash
    if (header->typeflag == '5' && name_target[name_len - 1] != '/') {
      name_target[name_len++] = '/';
      name_target[name_len] = 0;
    }

    // We iterate over all subpaths within the name to create the directories
    // and assign them the proper mtime and chmod permissions.
    for (zip_int32_t t = name_len - 1; t >= 0; --t) {
      if (name_target[t] != '/')
        continue;

      // We will temporarily replace the next character with a null byte to get
      // the directory name without having to clone the whole string
      char stored = name_target[t + 1];

      // We add the directory to the archive
      name_target[t + 1] = 0;
      zip_int64_t index = zip_dir_add(za, normalized_name, ZIP_FL_ENC_UTF_8);
      name_target[t + 1] = stored;

      if (index < 0) {
        // The directory already exists; we can ignore this error and abort
        // the loop, since if this folder exists then all its parents exist
        if (zip_error_code_zip(zip_get_error(za)) == ZIP_ER_EXISTS) {
          zip_error_clear(za);
          name_target[t + 1] = stored;
          break;
        }

        return -1;
      }

      if (zip_file_set_external_attributes(za, index, 0, ZIP_OPSYS_UNIX, (040000 | 0755) << 16) < 0) {
        return -1;
      }

      if (zip_file_set_mtime(za, index, SAFE_TIME, 0) < 0) {
        return -1;
      }
    }

    // We skip directories, since they have been created above
    if (header->typeflag == '5') {
      offset += sizeof(struct tar_header);
      continue;
    }

    zip_uint32_t orig_mode = 0;
    for (zip_uint8_t i = 0; i < 7 && header->mode[i] >= '0' && header->mode[i] <= '7'; i++) {
      orig_mode = orig_mode * 8 + (header->mode[i] - '0');
    }

    zip_uint64_t size = 0;
    for (zip_uint8_t i = 0; i < 11 && header->size[i] >= '0' && header->size[i] <= '7'; i++) {
      size = size * 8 + (header->size[i] - '0');
    }

    if (header->typeflag == '0' || header->typeflag == '\0') {
      zip_source_t *zs = zip_source_buffer(za, tar + offset + 512, size, 0);
      if (!zs) {
        return -1;
      }

      zip_int64_t index = zip_file_add(za, normalized_name, zs, ZIP_FL_ENC_UTF_8);
      if (zip_file_add(za, normalized_name, zs, ZIP_FL_ENC_UTF_8) < 0) {
        zip_source_free(zs);
        return -1;
      }

      zip_uint32_t mode = 0100000 | 0644;

      // If a single executable bit is set, normalize so that all are
      if (orig_mode & 0111) {
        mode |= 0111;
      }

      if (zip_file_set_external_attributes(za, index, 0, ZIP_OPSYS_UNIX, (0100000 | mode) << 16) < 0) {
        return -1;
      }

      if (zip_file_set_mtime(za, index, SAFE_TIME, 0) < 0) {
        return -1;
      }

      zip_uint64_t data_padding = size % 512 == 0 ? 0 : 512 - (size % 512);
      offset += 512 + size + data_padding;
    }
  }

  return 0;
}
