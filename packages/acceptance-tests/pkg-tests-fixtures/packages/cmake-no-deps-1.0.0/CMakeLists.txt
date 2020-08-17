cmake_minimum_required(VERSION 2.8)
project(no-deps-lib)

include("$ENV{CMAKE_YARN_DEFINITION_FILE}")
find_yarn_dependencies("${CMAKE_CURRENT_SOURCE_DIR}")

add_library(cmake-no-deps STATIC sources/cmake-no-deps.c)
target_include_directories(cmake-no-deps PUBLIC headers)
