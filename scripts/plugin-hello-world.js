module.exports = {
  name: `@yarnpkg/plugin-hello-world`,
  factory: require => {
    const {Command} = require(`clipanion`);
    const yup = require(`yup`);

    class HelloWorldCommand extends Command {
      async execute() {
        this.context.stdout.write(`Hello ${this.email} 💌\n`);
      }
    }

    // Note: This curious syntax is because @Command.String is actually
    // a decorator! But since they aren't supported in native JS at the
    // moment, we need to call them manually.
    HelloWorldCommand.addOption(`email`, Command.String(`--email`));

    // Similarly we would be able to use a decorator here too, but since
    // we're writing our code in JS-only we need to go through "addPath".
    HelloWorldCommand.addPath(`hello`);

    // Similarly, native JS doesn't support member variable as of today,
    // hence the awkward writing.
    HelloWorldCommand.schema = yup.object().shape({
      email: yup.string().required().email(),
    });

    // Show descriptive usage for a --help argument passed to this command
    HelloWorldCommand.usage = Command.Usage({
      description: `hello world!`,
      details: `
        This command will print a nice message.
      `,
      examples: [[
        `Say hello to an email user`,
        `yarn hello --email acidburn@example.com`,
      ]],
    });

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  },
};
