#include <string.h>
#include <zip.h>

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
    destination_max_index,

    prefix,
    155,

    &skip_depth,
    &state
  );

  if (prefix_len < 0)
    return -1;

  zip_int16_t name_len = process_name_segment(
    destination + prefix_len,
    destination_max_index - prefix_len,

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
  return 0;
  // We don't support gzipped tarballs
  if (tar[0] == 0x1f && tar[1] == 0x8b) {
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  static char normalized_name[512];

  int prefix_path_len = strlen(prefix_path);
  if (prefix_path_len > 256) {
    zip_error_set(zip_get_error(za), ZIP_ER_INVAL, 0);
    return -1;
  }

  memcpy(normalized_name, prefix_path, prefix_path_len);

  char* name_target = &normalized_name[prefix_path_len];
  zip_uint16_t name_target_max_index = sizeof(normalized_name) - prefix_path_len;

  zip_uint64_t offset = 0;

  while (offset < tar_size) {
    struct tar_header* header = (struct tar_header*)(tar + offset);
    if (header->name[0] == '\0') {
      break;
    }

    if (normalize_name(name_target, name_target_max_index, header->ustar_prefix, header->name, skip_depth) < 0) {
      continue;
    }

    zip_uint32_t mode = 0;
    for (int i = 0; i < 7 && header->mode[i] >= '0' && header->mode[i] <= '7'; i++) {
      mode = mode * 8 + (header->mode[i] - '0');
    }

    zip_uint64_t size = 0;
    for (int i = 0; i < 11 && header->size[i] >= '0' && header->size[i] <= '7'; i++) {
      size = size * 8 + (header->size[i] - '0');
    }

    char is_directory = header->typeflag == '5';
    char is_file = header->typeflag == '0' || header->typeflag == '\0';

    //printf("[%s] %lld\n", normalized_name, size);

    zip_source_t *zs = zip_source_buffer(za, tar + offset + 512, size, 0);
    if (!zs) {
      return -1;
    }

    if (zip_file_add(za, normalized_name, zs, ZIP_FL_ENC_UTF_8) < 0) {
      zip_source_free(zs);
      return -1;
    }

    zip_uint64_t data_padding = size % 512 == 0 ? 0 : 512 - (size % 512);
    offset += 512 + size + data_padding;
  }

  return 0;
}
