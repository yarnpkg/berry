#include <stdlib.h>
#include <string.h>
#include <zip.h>

struct zip_stat * zipstruct_stat(void)
{
    struct zip_stat * ptr = calloc(1, sizeof(struct zip_stat));

    return ptr;
}

struct zip_stat * zipstruct_statS(void)
{
    static struct zip_stat stat;

    memset(&stat, 0, sizeof(stat));

    return &stat;
}

char const * zipstruct_stat_name(struct zip_stat * st)
{
    return st->name;
}

int zipstruct_stat_index(struct zip_stat * st)
{
    return st->index;
}

unsigned int zipstruct_stat_size(struct zip_stat * st)
{
    return st->size;
}

unsigned int zipstruct_stat_mtime(struct zip_stat * st)
{
    return st->mtime;
}

struct zip_error * zipstruct_error(void)
{
    struct zip_error * ptr = calloc(1, sizeof(struct zip_error));

    return ptr;
}

struct zip_error * zipstruct_errorS(void)
{
    static struct zip_error error;

    memset(&error, 0, sizeof(error));

    return &error;
}
