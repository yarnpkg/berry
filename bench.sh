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
#   Time (mean ± σ):      4.099 s ±  0.010 s    [User: 4.920 s, System: 0.399 s]
#   Range (min … max):    4.087 s …  4.115 s    10 runs

# Benchmark 2: esbuild-no-cache
#   Time (mean ± σ):      6.133 s ±  0.036 s    [User: 5.415 s, System: 0.448 s]
#   Range (min … max):    6.088 s …  6.199 s    10 runs

# Benchmark 3: esbuild-partial-cache
#   Time (mean ± σ):      5.009 s ±  0.030 s    [User: 5.216 s, System: 0.417 s]
#   Range (min … max):    4.975 s …  5.067 s    10 runs

# Benchmark 4: babel-cache
#   Time (mean ± σ):      6.223 s ±  0.130 s    [User: 7.957 s, System: 0.646 s]
#   Range (min … max):    6.076 s …  6.538 s    10 runs

# Benchmark 5: babel-no-cache
#   Time (mean ± σ):     11.243 s ±  0.036 s    [User: 16.104 s, System: 0.764 s]
#   Range (min … max):   11.195 s … 11.291 s    10 runs

# Benchmark 6: babel-partial-cache
#   Time (mean ± σ):      7.155 s ±  0.048 s    [User: 9.816 s, System: 0.660 s]
#   Range (min … max):    7.092 s …  7.254 s    10 runs

# Summary
#   'esbuild-cache' ran
#     1.22 ± 0.01 times faster than 'esbuild-partial-cache'
#     1.50 ± 0.01 times faster than 'esbuild-no-cache'
#     1.52 ± 0.03 times faster than 'babel-cache'
#     1.75 ± 0.01 times faster than 'babel-partial-cache'
#     2.74 ± 0.01 times faster than 'babel-no-cache'
