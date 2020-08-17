cmake_minimum_required(VERSION 2.8)
project(cmake-one-dep)

include("$ENV{CMAKE_YARN_DEFINITION_FILE}")
find_yarn_dependencies("${CMAKE_CURRENT_SOURCE_DIR}")

add_library(cmake-one-dep STATIC sources/cmake-one-dep.c)
target_include_directories(cmake-one-dep PUBLIC headers)
target_link_libraries(cmake-one-dep cmake-no-deps)
