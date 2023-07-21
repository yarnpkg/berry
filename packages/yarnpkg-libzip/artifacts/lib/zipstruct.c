#include <stdlib.h>
#include <string.h>
#include <zip.h>

struct zip_stat * zipstruct_statS(void)
{
    static struct zip_stat stat;

    memset(&stat, 0, sizeof(stat));

    return &stat;
}

unsigned int zipstruct_stat_size(struct zip_stat * st)
{
    return st->size;
}

unsigned int zipstruct_stat_mtime(struct zip_stat * st)
{
    return st->mtime;
}

unsigned int zipstruct_stat_crc(struct zip_stat * st)
{
    return st->crc;
}

struct zip_error * zipstruct_errorS(void)
{
    static struct zip_error error;

    memset(&error, 0, sizeof(error));

    return &error;
}

int zipstruct_error_code_zip(struct zip_error * error)
{
    return error->zip_err;
}

unsigned int zipstruct_stat_comp_size(struct zip_stat * st)
{
    return st->comp_size;
}

unsigned int zipstruct_stat_comp_method(struct zip_stat * st)
{
    return st->comp_method;
}
