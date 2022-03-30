#include <sys/stat.h>
#include <config.h>
#include <zipint.h>

int zip_ext_count_symlinks(zip_t *za)
{
  int count = 0;

  zip_uint64_t i;
  zip_uint8_t opsys;
  zip_uint32_t attributes;

  for (i = 0; i < za->nentry; i++)
  {
    int attrs = zip_file_get_external_attributes(za, i, 0, &opsys, &attributes);
    if (attrs == -1)
    {
      return -1;
    }

    if (opsys == ZIP_OPSYS_UNIX && ((attributes >> 16) & S_IFMT) == S_IFLNK)
    {
      count++;
    }
  }

  return count;
}
