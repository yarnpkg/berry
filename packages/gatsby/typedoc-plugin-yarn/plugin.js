const {ConverterComponent} = require(`typedoc/dist/lib/converter/components`);

const {Converter} = require(`typedoc/dist/lib/converter/converter`);
const {CommentPlugin} = require(`typedoc/dist/lib/converter/plugins/CommentPlugin`);
const {ReflectionKind} = require(`typedoc/dist/lib/models/reflections/abstract`);

exports.YarnPlugin = class YarnPlugin extends ConverterComponent {
  constructor(owner) {
    super(owner);
    this.name = `yarn-plugin`;
  }

  initialize() {
    this.listenTo(this.owner, {
      [Converter.EVENT_CREATE_DECLARATION]: this.onDeclarationBegin,
    });
  }

  onDeclarationBegin(context, reflection) {
    // Remove unnecessary reflections generated from virtual files
    if (reflection.sources && reflection.sources[0].fileName.includes(`.yarn/$$virtual/`)) {
      CommentPlugin.removeReflection(context.project, reflection);
      console.log(
        `Removing unnecessary reflection generated from virtual file: `,
        reflection.sources[0].fileName,
      );
    }

    // Remove unnecessary reference reflections
    if (reflection.kind === ReflectionKind.Reference) {
      CommentPlugin.removeReflection(context.project, reflection);
      console.log(
        `Removing unnecessary reference reflection: `,
        reflection.name,
      );
    }
  }
};
