#include <string.h>
#include <zip.h>

#if 0
#include <stdio.h>
#define LOG(...) do { printf(__VA_ARGS__); } while (0)
#else
#define LOG(...) do {} while (0)
#endif

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

/**
 * Push a string segment into a dedicated buffer. If a backtraversal is
 * detected, the execution is aborted.
 *
 * Because tar files store filenames in multiple fields, we need to be able to
 * call this function multiple times (while persisting its state) to compute
 * the whole path. That's why skip_depth and state are passed by pointers.
 */
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
        if (*state == 0) {
          destination[index++] = '.';
        } else if (*state == 1) {
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
          LOG("Backtraversal detected\n");
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
  if (prefix[0] == '/' || prefix[0] == 0 && name[0] == '/') {
    LOG("Absolute path detected\n");
    return -1;
  }

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
  if (state == 2 || state == 3) {
    LOG("Unexpected end state (%d)\n", state);
    return -1;
  }

  // Not deep enough
  if (skip_depth > 0) {
    LOG("Not deep enough (missing %d segments)\n", skip_depth);
    return -1;
  }

  destination[prefix_len + name_len] = 0;

  // Note: we allow trailing slashes, they are usually directories
  return 0;
}

/**
 * Iterate over a string to generate all the directory paths between the
 * starting offset and the given length.
 *
 * The string will be modified in-place during the search, but is guaranteed
 * to be left in the same state as it was at the beginning when the function
 * returns.
 *
 * The search is done backwards (first we create foo/bar/baz, then foo/bar,
 * and finally foo) to let us abort as soon as we find an existing directory.
 */
static int add_subdirectories(zip_t* za, char* name, zip_uint16_t offset, zip_uint16_t len)
{
  // We iterate over all subpaths within the name to create the directories
  // and assign them the proper mtime and chmod permissions.
  for (zip_int32_t t = offset + len - 1; t >= offset; --t) {
    if (name[t] != '/')
      continue;

    // We will temporarily replace the next character with a null byte to get
    // the directory name without having to clone the whole string
    char stored = name[t + 1];

    // We add the directory to the archive
    name[t + 1] = 0;
    LOG("Adding directory (%s)\n", name);
    zip_int64_t index = zip_dir_add(za, name, ZIP_FL_ENC_UTF_8);
    name[t + 1] = stored;

    if (index < 0) {
      // The directory already exists; we can ignore this error and abort
      // the loop, since if this folder exists then all its parents exist
      if (zip_error_code_zip(zip_get_error(za)) == ZIP_ER_EXISTS) {
        zip_error_clear(za);
        name[t + 1] = stored;
        break;
      }

      return -1;
    }

    if (zip_file_set_external_attributes(za, index, 0, ZIP_OPSYS_UNIX, (040000 | 0755) << 16) < 0) {
      LOG("Failed to set directory permissions\n");
      return -1;
    }

    if (zip_file_set_mtime(za, index, SAFE_TIME, 0) < 0) {
      LOG("Failed to set directory mtime\n");
      return -1;
    }
  }

  return 0;
}

zip_int64_t zip_ext_import_tar(
  zip_t* za,

  unsigned char *tar,
  zip_uint64_t tar_size,

  zip_int32_t comp,
  zip_uint32_t comp_flags,

  zip_uint8_t skip_depth,
  char const* prefix_path
) {
  // We don't support gzipped tarballs
  if (tar[0] == 0x1f && tar[1] == 0x8b) {
    LOG("Gzipped tarballs are not supported\n");
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  if (tar_size < 512) {
    LOG("Tarball is too small (%llu)\n", tar_size);
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
  // can only be 512 - 100 - 155 - 3 bytes long (we reserve three bytes: one
  // for a possible trailing slash at the end of the prefix path, another for
  // in a possible trailing slash at the end of the path, and a third one for
  // the trailing \0).
  if (prefix_path_len > sizeof(normalized_name) - 100 - 155 - 3) {
    LOG("Prefix path is too long (%d)\n", prefix_path_len);
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  if (prefix_path_len > 0) {
    memcpy(normalized_name, prefix_path, prefix_path_len);
    if (prefix_path[prefix_path_len - 1] != '/') {
      normalized_name[prefix_path_len] = '/';
      prefix_path_len += 1;
    }
  }

  if (add_subdirectories(za, normalized_name, 0, prefix_path_len) < 0) {
    return -1;
  }

  char* name_target = &normalized_name[prefix_path_len];
  zip_uint16_t name_target_max_index = sizeof(normalized_name) - prefix_path_len - 1;

  for (zip_uint64_t offset = 0; offset < tar_size - 512;) {
    struct tar_header* header = (struct tar_header*)(tar + offset);
    if (header->name[0] == '\0') {
      break;
    }

    char const* data = (char const*)(tar + offset + 512);

    zip_uint64_t size = 0;
    for (zip_uint8_t i = 0; i < 11 && header->size[i] >= '0' && header->size[i] <= '7'; i++) {
      size = size * 8 + (header->size[i] - '0');
    }

    zip_uint64_t data_padding = size % 512 == 0 ? 0 : 512 - (size % 512);
    zip_uint64_t remaining_data_size = tar_size - offset - 512;

    if (remaining_data_size < size + data_padding) {
      LOG("Tarball is truncated (%llu)\n", remaining_data_size);
      zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
      return -1;
    }

    offset += 512 + size + data_padding;

    zip_int16_t name_len = normalize_name(name_target, name_target_max_index, header->ustar_prefix, header->name, skip_depth);
    if (name_len < 0) {
      LOG("Skipping path (%.155s%.100s)\n", header->ustar_prefix, header->name);
      continue;
    }

    // We make sure that all directory names end with a trailing slash
    if (header->typeflag == '5' && name_target[name_len - 1] != '/') {
      name_target[name_len++] = '/';
      name_target[name_len] = 0;
    }

    // We iterate over all subpaths within the name to create the directories
    // and assign them the proper mtime and chmod permissions.
    if (add_subdirectories(za, normalized_name, prefix_path_len, name_len) < 0) {
      return -1;
    }

    // We skip directories, since they have been created above
    if (header->typeflag == '5') {
      continue;
    }

    zip_uint32_t orig_mode = 0;
    for (zip_uint8_t i = 0; i < 7 && header->mode[i] >= '0' && header->mode[i] <= '7'; i++) {
      orig_mode = orig_mode * 8 + (header->mode[i] - '0');
    }

    if (header->typeflag == '0' || header->typeflag == '\0') {
      zip_source_t *zs = zip_source_buffer(za, data, size, 0);
      if (!zs) {
        LOG("Failed to create source buffer\n");
        return -1;
      }

      LOG("Adding file (%s)\n", normalized_name);

      zip_int64_t index = zip_file_add(za, normalized_name, zs, ZIP_FL_ENC_UTF_8);
      if (index < 0) {
        LOG("Failed to add file to archive (%s)\n", normalized_name);
        zip_source_free(zs);
        return -1;
      }

      zip_uint32_t mode = 0100000 | 0644;

      // If a single executable bit is set, normalize so that all are
      if (orig_mode & 0111) {
        mode |= 0111;
      }

      if (zip_set_file_compression(za, index, comp, comp_flags) < 0) {
        LOG("Failed to set file compression\n");
        return -1;
      }

      if (zip_file_set_external_attributes(za, index, 0, ZIP_OPSYS_UNIX, (0100000 | mode) << 16) < 0) {
        LOG("Failed to set file permissions\n");
        return -1;
      }

      if (zip_file_set_mtime(za, index, SAFE_TIME, 0) < 0) {
        LOG("Failed to set file mtime\n");
        return -1;
      }
    } else {
      LOG("Unsupported typeflag: %c\n", header->typeflag);
    }
  }

  return 0;
}
