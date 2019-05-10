workflow "Build and deploy the documentation" {
  on = "push"
  resolves = ["doc-build-push"]
}

action "doc-check-user" {
  uses = "actions/bin/filter@master"
  args = "not actor yarnbot"
}

action "doc-check-branch" {
  uses = "actions/bin/filter@master"
  args = "branch master"
  needs = ["doc-check-user"]
}

action "doc-check-gatsby-path" {
  uses = "./scripts/actions/if-path-changed"
  args = "^packages/gatsby/"
  needs = ["doc-check-branch"]
}

# We need to use `yarn install` because Gatsby has native
# dependencies that must be compiled against the system
action "doc-yarn-install" {
  uses = "./scripts/actions/local-yarn-command"
  args = "install --inline-builds"
  needs = ["doc-check-gatsby-path"]
}

action "doc-build-documentation" {
  uses = "./scripts/actions/local-yarn-command"
  args = "build:doc --verbose"
  needs = ["doc-yarn-install"]
}

action "doc-build-push" {
  uses = "./scripts/actions/make-commit"
  args = "Updates the documentation website"
  needs = ["doc-build-documentation"]
  secrets = ["YARNBOT_TOKEN"]
}
