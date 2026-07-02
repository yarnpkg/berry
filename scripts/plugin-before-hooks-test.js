module.exports = {
  name: `@yarnpkg/plugin-before-hooks-test`,
  factory: () => {
    return {
      hooks: {
        beforeWorkspaceDependencyAddition: async (workspace, target, descriptor) => {
          if (descriptor.name === `no-deps`) {
            descriptor.range = `^1.0.0`;
          }
        },

        beforeWorkspaceDependencyReplacement: async (workspace, target, fromDescriptor, toDescriptor) => {
          if (toDescriptor.name === `no-deps`) {
            toDescriptor.range = `^2.0.0`;
          }
        },

        beforeWorkspaceDependencyRemoval: async (workspace, target, descriptor) => {
          if (descriptor.name === `no-deps`) {
            throw new Error(`Cannot remove no-deps - it is protected`);
          }
        },
      },
    };
  },
};
