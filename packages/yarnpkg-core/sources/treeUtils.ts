import {Writable}       from 'stream';
import {asTree}         from 'treeify';

import {Configuration}  from './Configuration';
import * as formatUtils from './formatUtils';

export type TreeNode = {
  label?: string,
  value?: formatUtils.Tuple,
  children?: Array<TreeNode> | TreeMap;
};

export type TreeMap = {
  [key: string]: TreeNode,
};

export type TreeifyNode = {
  [key: string]: TreeifyNode;
}

export function treeNodeToTreeify(printTree: TreeNode, {configuration}: {configuration: Configuration}) {
  const target = {};

  const copyTree = (printNode: Array<TreeNode> | TreeMap, targetNode: TreeifyNode) => {
    const iterator = Array.isArray(printNode)
      ? printNode.entries()
      : Object.entries(printNode);

    for (const [key, {label, value, children}] of iterator) {
      const finalParts = [];
      if (typeof label !== `undefined`)
        finalParts.push(formatUtils.applyStyle(configuration, label, formatUtils.Style.BOLD));
      if (typeof value !== `undefined`)
        finalParts.push(formatUtils.pretty(configuration, value[0], value[1]));
      if (finalParts.length === 0)
        finalParts.push(formatUtils.applyStyle(configuration, `${key}`, formatUtils.Style.BOLD));

      const finalLabel = finalParts.join(`: `);
      const createdNode = targetNode[finalLabel] = {};

      if (typeof children !== `undefined`) {
        copyTree(children, createdNode);
      }
    }
  };

  if (typeof printTree.children === `undefined`)
    throw new Error(`The root node must only contain children`);

  copyTree(printTree.children, target);
  return target;
}

export function treeNodeToJson(printTree: TreeNode) {
  const target = {};

  const copyTree = (printNode: Array<TreeNode> | TreeMap, targetNode: any) => {
    const iterator = Array.isArray(printNode)
      ? printNode.entries()
      : Object.entries(printNode);

    for (const [key, {value, children}] of iterator) {
      const createdNodeChildren = Array.isArray(children) ? [] : {};
      const createdNode: any = targetNode[key] = {children: createdNodeChildren};

      if (typeof value !== `undefined`)
        createdNode.value = formatUtils.json(value[0], value[1]);

      if (typeof createdNode.value === `undefined`)
        delete createdNode.value;

      const childCount = typeof children !== `undefined`
        ? Array.isArray(children)
          ? children.length
          : Object.keys(children).length
        : 0;

      if (childCount === 0)
        delete createdNode.children;

      if (typeof children !== `undefined`) {
        copyTree(children, createdNodeChildren);
      }
    }
  };

  if (typeof printTree.children === `undefined`)
    throw new Error(`The root node must only contain children`);

  copyTree(printTree.children, target);
  return target;
}

export function emitList(values: Array<formatUtils.Tuple>, {configuration, stdout, json}: {configuration: Configuration, stdout: Writable, json: boolean}) {
  const children = values.map(value => ({value}));
  emitTree({children}, {configuration, stdout, json});
}

export function emitTree(tree: TreeNode, {configuration, stdout, json, separators = 0}: {configuration: Configuration, stdout: Writable, json: boolean, separators?: number}) {
  if (json) {
    stdout.write(`${JSON.stringify(treeNodeToJson(tree))}\n`);
    return;
  }

  let treeOutput = asTree(treeNodeToTreeify(tree, {configuration}) as any, false, false);

  // A slight hack to add line returns between two top-level entries
  if (separators >= 1)
    treeOutput = treeOutput.replace(/^([├└]─)/gm, `│\n$1`).replace(/^│\n/, ``);

  // Another one for the second level fields. We run it twice because in some pathological cases the regex matches would
  if (separators >= 2)
    for (let t = 0; t < 2; ++t)
      treeOutput = treeOutput.replace(/^([│ ].{2}[├│ ].{2}[^\n]+\n)(([│ ]).{2}[├└].{2}[^\n]*\n[│ ].{2}[│ ].{2}[├└]─)/gm, `$1$3  │\n$2`).replace(/^│\n/, ``);

  if (separators >= 3)
    throw new Error(`Only the first two levels are accepted by treeUtils.emitTree`);

  stdout.write(treeOutput);
}
