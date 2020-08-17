module.exports = {
  name: `@yarnpkg/plugin-hello-universe`,
  factory: require => {
    const {Command} = require(`clipanion`);
    const yup = require(`yup`);

    class HelloUniverseCommand extends Command {
      async execute() {
        this.context.stdout.write(`Hello ${this.email} 💌\n`);
      }
    }

    // Note: This curious syntax is because @Command.String is actually
    // a decorator! But since they aren't supported in native JS at the
    // moment, we need to call them manually.
    HelloUniverseCommand.addOption(`email`, Command.String(`--email`));

    // Similarly we would be able to use a decorator here too, but since
    // we're writing our code in JS-only we need to go through "addPath".
    HelloUniverseCommand.addPath(`hello`, `universe`);

    // Similarly, native JS doesn't support member variable as of today,
    // hence the awkward writing.
    HelloUniverseCommand.schema = yup.object().shape({
      email: yup.string().required().email(),
    });

    // Show descriptive usage for a --help argument passed to this command
    HelloUniverseCommand.usage = Command.Usage({
      description: `hello universe!`,
      details: `
        This command will print a nice message.
      `,
      examples: [[
        `Say hello to an email user`,
        `yarn hello universe --email acidburn@example.com`,
      ]],
    });

    return {
      commands: [
        HelloUniverseCommand,
      ],
    };
  },
};
