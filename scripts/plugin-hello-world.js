module.exports = {
  name: `@yarnpkg/plugin-hello-world`,
  factory: require => {
    const {Command, Option} = require(`clipanion`);
    const t = require(`typanion`);

    class HelloWorldCommand extends Command {
      static paths = [
        [`hello`],
      ];

      static usageusage = Command.Usage({
        description: `hello world!`,
        details: `
          This command will print a nice message.
        `,
        examples: [[
          `Say hello to an email user`,
          `yarn hello --email acidburn@example.com`,
        ]],
      });

      email = Option.String(`--email`, {
        validator: t.applyCascade(t.isString(), [
          t.matchesRegExp(/@/),
        ]),
      });

      async execute() {
        this.context.stdout.write(`Hello ${this.email} 💌\n`);
      }
    }

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  },
};
