import visit from 'unist-util-visit-parents';

export type AutoLinkSpec = {
  sourceType: `json-schema`;
  path: string;
  urlGenerator: (name: string) => string;
};

export const plugin = (userSpecs: Array<AutoLinkSpec>) => () => {
  const specP = Promise.all(userSpecs.map(async userSpec => {
    if (userSpec.sourceType === `json-schema`) {
      const schema = await import(userSpec.path);
      return {
        ...userSpec,
        schema,
      };
    } else {
      throw new Error(`Unsupported source type: ${userSpec.sourceType}`);
    }
  }));

  console.log(`Searching for autolinks`);

  const transformer = async ast => {
    const specs = await specP;
    let hasAutoLinks = false;

    visit(ast, (node, ancestors) => {
      if (node.type !== `inlineCode`)
        return;

      const match = (node.value as string).match(/^(?<name>[^:]+)(?:: (?<value>.*))?$/);
      if (!match)
        return;

      const segments = match.groups!.name.split(`.`);

      let result: {
        title: string;
        url: string | null;
      } | undefined;

      specs.find(spec => {
        let node = spec.schema;

        for (const segment of segments) {
          if (node.type === `object`) {
            if (!Object.hasOwn(node.properties, segment))
              return false;

            node = node.properties[segment];
          }
        }

        if (typeof node.title === `undefined`)
          return false;

        const url = !ancestors.find(ancestor => ancestor.type === `link`)
          ? spec.urlGenerator(segments.join(`.`))
          : null;

        result = {
          title: node.title,
          url,
        };

        return true;
      });

      if (typeof result === `undefined`)
        return;

      const highlightNode = {
        type: `jsx`,
        value: `<AutoLink {...${JSON.stringify({
          ...match.groups,
          ...result,
        })}}/>`,
      };

      const parent = ancestors[ancestors.length - 1];
      const index = parent.children.indexOf(node);

      parent.children[index] = highlightNode;
      hasAutoLinks = true;
    });

    if (hasAutoLinks) {
      ast.children.unshift({
        type: `import`,
        value: `import {AutoLink} from '@yarnpkg/docusaurus/src/components/AutoLink';\n`,
      });
    }
  };

  return transformer;
};
