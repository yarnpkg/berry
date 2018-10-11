import TextLayout = require('@manaflair/text-layout');
// @ts-ignore
import makeReconciler = require('react-reconciler');
import React = require('react');
// @ts-ignore
import ttys = require('ttys');
// @ts-ignore
import YogaDom = require('yoga-dom');

import {Div}          from './Div';
import {NodeElement}  from './NodeElement';
import {NodeText}     from './NodeText';
import {NodeTree}     from './NodeTree';
import {Node}         from './Node';
import {TermInput}    from './TermInput';
import {TermOutput}   from './TermOutput';
import {TermRenderer} from './TermRenderer';
import {Props}        from './types';

// Reexport the Div component
export * from './Div';

type HostContext = {
};

const Reconciler = makeReconciler({
  useSyncScheduling: true,

  now() {
    return Date.now;
  },

  getRootHostContext(): HostContext {
    return {};
  },

  getChildHostContext(): HostContext {
    return {};
  },

  createInstance(type: string, props: Props, container: NodeTree, hostContext: HostContext) {
    return new NodeElement(container.env, props);
  },

  createTextInstance(text: string, container: NodeTree, hostContext: HostContext) {
    return new NodeText(container.env, text);
  },

  getPublicInstance(element: NodeElement) {
    return element;
  },

  appendInitialChild(element: NodeElement, child: Node) {
    element.appendChild(child);
  },

  finalizeInitialChildren(element: NodeElement, type: string, props: Object, container: NodeTree) {
    return true;
  },

  prepareUpdate(element: NodeElement) {
    return true;
  },

  prepareForCommit(container: NodeTree) {
    return {};
  },

  resetAfterCommit(container: NodeTree, prepareData: any) {
    container.requestRender();
  },

  shouldSetTextContent(type: string, props: Props) {
    return false;
  },

  shouldDeprioritizeSubtree(type: string, props: Props) {
    return false;
  },

  scheduleDeferredCallback(callback: () => void) {
    setImmediate(callback);
  },

  supportsMutation: true,
  supportsPersistence: false,

  commitMount(element: NodeElement, type: string, newProps: Props) {
  },

  commitUpdate(element: NodeElement, updatePayload: any, type: string, oldProps: Props, newProps: Props) {
    element.setProps(newProps);
  },

  commitTextUpdate(text: NodeText, oldContent: string, newContent: string) {
    text.setTextContent(newContent);
  },

  appendChild(element: NodeElement, child: Node) {
    element.appendChild(child);
  },

  appendChildToContainer(container: NodeTree, child: Node) {
    container.appendChild(child);
  },

  insertBefore(element: NodeElement, child: Node, before: Node) {
    element.insertBefore(child, before);
  },

  insertInContainerBefore(container: NodeTree, child: Node, before: Node) {
    container.insertBefore(child, before);
  },

  removeChild(element: Node, child: Node) {
    element.removeChild(child);
  },

  removeChildFromContainer(container: NodeTree, child: Node) {
    container.removeChild(child);
  },

  resetTextContent(element: NodeElement) {
    throw new Error(`Unreachable`);
  },
});

export async function render(app: any, {stdin = ttys.stdin, stdout = ttys.stdout, inline = false} = {}) {
  // Not sure why we have to do this, but the ".default" is needed when adding "browser" field support
  const realYogaDom = YogaDom.default || YogaDom;

  const env = {yoga: await realYogaDom, textLayout: await TextLayout};

  return new Promise((resolve, reject) => {
    const termInput = new TermInput(stdin);
    const termOutput = new TermOutput(stdout, {isInline: inline, isDebug: false});

    const termRenderer = new TermRenderer(termInput, termOutput);

    const nodeTree = new NodeTree(env, update, shutdown);
    nodeTree.resize(termOutput.columns, termOutput.rows);

    const container = Reconciler.createContainer(nodeTree);

    function start() {
      termInput.on(`mouse`, e => {
        Reconciler.batchedUpdates(() => {
          e.mouse.y -= inline ? termRenderer.inlineTop : 0;
          nodeTree.emitMouse(e.mouse);
        });
      });

      termInput.on(`key`, (e: any) => {
        Reconciler.batchedUpdates(() => {
          nodeTree.emitKey(e.key);
        });
      });

      termInput.on(`data`, (e: any) => {
        Reconciler.batchedUpdates(() => {
          nodeTree.emitData(e.buffer);
        });
      });

      termOutput.on(`resize`, ({columns, rows}) => {
        nodeTree.resize(columns, rows);
      });

      if (termOutput.isDebug)
        console.log(`Debug`);

      termRenderer.open();

      Reconciler.unbatchedUpdates(() => {
        Reconciler.updateContainer(app, container, null, null);
      });
    }

    function update() {
      termRenderer.render(nodeTree);
    }

    function shutdown() {
      // Clear the output
      termRenderer.close();

      // Unmount everything
      Reconciler.unbatchedUpdates(() => {
        Reconciler.updateContainer(React.createElement(Div), container, null, null);
      });
      
      resolve();
    }

    start();
  });
}
