import {Command} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default {
  commands: [
    class Foo extends Command {
      static paths = [
        [`foo`],
      ];

      async execute() {
        this.context.stdout.write(`foo`);
      }
    },
  ],
};
