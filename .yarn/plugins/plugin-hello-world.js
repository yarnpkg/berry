module.exports = {
  name: `plugin-hello-world`,
  factory: require => {
    const {Command} = require(`clipanion`);

    class HelloWorldCommand extends Command {
      async execute() {
        this.context.stdout.write(`This is my very own plugin 😎\n`);
      }
    }
    
    HelloWorldCommand.addPath(`hello`);

    return {
      commands: [
        HelloWorldCommand,
      ],
    };
  }
};
