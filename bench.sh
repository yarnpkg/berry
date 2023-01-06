hyperfine -w 1 \
  -n esbuild-cache \
  --prepare "" \
  "YARNPKG_TRANSPILER=esbuild node ./scripts/run-yarn.js exec yarn -v" \
  -n esbuild-no-cache \
  --prepare "rm -r ./node_modules/.cache/yarn" \
  "YARNPKG_TRANSPILER=esbuild node ./scripts/run-yarn.js exec yarn -v" \
  -n esbuild-partial-cache \
  --prepare "echo '//' | tee -a packages/yarnpkg-core/sources/*.ts" \
  "YARNPKG_TRANSPILER=esbuild node ./scripts/run-yarn.js exec yarn -v" \
  -n babel-cache \
  --prepare "" \
  "YARNPKG_TRANSPILER=babel node ./scripts/run-yarn.js exec yarn -v" \
  -n babel-no-cache \
  --prepare "rm -r /tmp/babel" \
  "YARNPKG_TRANSPILER=babel node ./scripts/run-yarn.js exec yarn -v" \
  -n babel-partial-cache \
  --prepare "echo '//' | tee -a packages/yarnpkg-core/sources/*.ts" \
  "YARNPKG_TRANSPILER=babel node ./scripts/run-yarn.js exec yarn -v"

# Benchmark 1: esbuild-cache
#   Time (mean ± σ):      4.080 s ±  0.030 s    [User: 4.915 s, System: 0.419 s]
#   Range (min … max):    4.043 s …  4.124 s    10 runs

# Benchmark 2: esbuild-no-cache
#   Time (mean ± σ):      6.108 s ±  0.025 s    [User: 5.455 s, System: 0.457 s]
#   Range (min … max):    6.079 s …  6.151 s    10 runs

# Benchmark 3: esbuild-partial-cache
#   Time (mean ± σ):      5.011 s ±  0.023 s    [User: 5.223 s, System: 0.472 s]
#   Range (min … max):    4.972 s …  5.044 s    10 runs

# Benchmark 4: babel-cache
#   Time (mean ± σ):      6.188 s ±  0.093 s    [User: 8.045 s, System: 0.587 s]
#   Range (min … max):    6.056 s …  6.315 s    10 runs

# Benchmark 5: babel-no-cache
#   Time (mean ± σ):     11.202 s ±  0.056 s    [User: 16.060 s, System: 0.793 s]
#   Range (min … max):   11.107 s … 11.313 s    10 runs

# Benchmark 6: babel-partial-cache
#   Time (mean ± σ):      7.136 s ±  0.050 s    [User: 9.834 s, System: 0.642 s]
#   Range (min … max):    7.049 s …  7.200 s    10 runs

# Summary
#   'esbuild-cache' ran
#     1.23 ± 0.01 times faster than 'esbuild-partial-cache'
#     1.50 ± 0.01 times faster than 'esbuild-no-cache'
#     1.52 ± 0.03 times faster than 'babel-cache'
#     1.75 ± 0.02 times faster than 'babel-partial-cache'
#     2.75 ± 0.02 times faster than 'babel-no-cache'
