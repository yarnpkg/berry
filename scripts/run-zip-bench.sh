SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)

export PATH="$HOME/node/out/Release:$PATH"
export YARN_IGNORE_PATH=1

for YARN_EXPERIMENT_NATIVE_ZIPFS in 0 1; do
  for YARN_EXPERIMENT_RUN_IN_BAND in 0 1; do
    OPTS="YARN_EXPERIMENT_NATIVE_ZIPFS=$YARN_EXPERIMENT_NATIVE_ZIPFS YARN_EXPERIMENT_RUN_IN_BAND=$YARN_EXPERIMENT_RUN_IN_BAND"
    echo $OPTS

    cd $(mktemp -d)
    echo '{}' > package.json

    export YARN_EXPERIMENT_NATIVE_ZIPFS
    export YARN_EXPERIMENT_RUN_IN_BAND

    export YARN_GLOBAL_FOLDER=$(pwd)/.yarn/global

    node "$SCRIPT_DIR"/packages/yarnpkg-cli/bundles/yarn.js add gatsby | grep 'Completed' | sed -n '2p'
  done
done
