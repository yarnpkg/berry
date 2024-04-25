import {fromJs}                 from 'esast-util-from-js';
import type {MdxJsxFlowElement} from 'mdast-util-mdx-jsx';
import type {Parent, Root}      from 'mdast';
import type {Transformer}       from 'unified';
import {visitParents as visit}  from 'unist-util-visit-parents';
import {pathToFileURL}          from 'url';

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

  const transformer: Transformer<Root> = async ast => {
    const specs = await specP;
    let hasAutoLinks = false;

    visit(ast, (node, ancestors) => {
      if (node.type !== `inlineCode`)
        return;

      const match = node.value.match(/^(?<name>[^:]+)(?:: (?<value>.*))?$/);
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

      const attributes = {...match.groups, ...result};
      const highlightNode: MdxJsxFlowElement = {
        type: `mdxJsxFlowElement`,
        name: `AutoLink`,
        attributes: [{
          type: `mdxJsxExpressionAttribute`,
          value: `...${JSON.stringify(attributes)}`,
          data: {estree: fromJs(`({...${JSON.stringify(attributes)}})`, {module: true})},
        }],
        children: [],
      };

      const parent: Parent = ancestors[ancestors.length - 1];
      const index = parent.children.indexOf(node);

      parent.children[index] = highlightNode;
      hasAutoLinks = true;
    });

    if (hasAutoLinks) {
      const url = pathToFileURL(require.resolve(`../components/AutoLink.tsx`));
      const code = `import {AutoLink} from ${JSON.stringify(url)};\n`;
      ast.children.unshift({
        type: `mdxjsEsm`,
        value: code,
        data: {estree: fromJs(code, {module: true})},
      });
    }
  };

  return transformer;
};
