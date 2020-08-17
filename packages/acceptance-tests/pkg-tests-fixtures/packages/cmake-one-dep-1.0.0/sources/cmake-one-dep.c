#include <cmake-no-deps.h>
#include <cmake-one-dep.h>

int cmake_one_dep(int a, int b, int c, int d) {
  return cmake_no_deps(a, b) * cmake_no_deps(c, d);
}
