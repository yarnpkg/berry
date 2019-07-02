# The `| cat` aims to workaround this request:
# https://github.com/gatsbyjs/gatsby/blob/99fb7b44810d658805211073ddfc18e508b57c87/packages/gatsby-cli/src/init-starter.js#L40
yarn dlx gatsby new my-gatsby | cat
cd my-gatsby
yarn build
