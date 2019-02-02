// @ts-ignore
import {feature, screen, cursor, style}       from '@manaflair/term-strings';

import {DirtyScreen}                          from './DirtyScreen';
import {NodeTree}                             from './NodeTree';
import {Node}                                 from './Node';
import {Segment}                              from './Segment';
import {TermInput}                            from './TermInput';
import {TermOutput}                           from './TermOutput';
import {findOverlapingSegment, removeSegment} from './geometryUtils';

function getCaretX(caret: any) {
  return caret.x || caret.left || caret.column || caret[0] || 0;
}

function getCaretY(caret: any) {
  return caret.y || caret.top || caret.row || caret[1] || 0;
}

export class TermRenderer {

  private readonly termInput: TermInput;
  private readonly termOutput: TermOutput;

  private opened: boolean = false;

  public inlineTop: number = 0;

  constructor(termInput: TermInput, termOutput: TermOutput) {
    this.termInput = termInput;
    this.termOutput = termOutput;
  }

  open() {
    if (this.opened)
      return;

    this.termInput.open();
    this.termOutput.open();

    process.on(`uncaughtException`, this.handleException);
    process.on(`exit`, this.handleExit);

    process.on(`SIGINT`, this.handleExitSignal);
    process.on(`SIGTERM`, this.handleExitSignal);

    this.termOutput.buffer(() => {
      // Enter the alternate screen
      if (!this.termOutput.isInline)
        this.termOutput.writeMeta(screen.alternateScreen.in);

      // Disable the terminal soft wrapping
      this.termOutput.writeMeta(screen.noWrap.in);

      // Hide the cursor (it will be rendered with everything else later)
      this.termOutput.writeMeta(cursor.hidden);

      // Enable mouse tracking (all events are tracked, even when the mouse button isn't pressed)
      this.termOutput.writeMeta(feature.enableMouseHoldTracking.in);
      this.termOutput.writeMeta(feature.enableMouseMoveTracking.in);
      this.termOutput.writeMeta(feature.enableExtendedCoordinates.in);

      // Clear the current font style so that we aren't polluted by previous applications
      if (!this.termOutput.isInline)
        this.termOutput.writeMeta(style.clear);

      // Ensure we capture as much things as possible from the keyboard (like ^C)
      this.termInput.setRawMode(true);
    });

    this.opened = true;
  }

  close() {
    if (!this.opened)
      return;

    process.removeListener(`uncaughtException`, this.handleException);
    process.removeListener(`exit`, this.handleExit);

    process.removeListener(`SIGINT`, this.handleExitSignal);
    process.removeListener(`SIGTERM`, this.handleExitSignal);

    this.termOutput.buffer(() => {
      this.termInput.setRawMode(false);

      // Clear the current font style to avoid polluting the other applications
      this.termOutput.writeMeta(style.clear);

      // Disable the various mouse tracking modes
      this.termOutput.writeMeta(feature.enableExtendedCoordinates.out);
      this.termOutput.writeMeta(feature.enableMouseMoveTracking.out);
      this.termOutput.writeMeta(feature.enableMouseHoldTracking.out);

      // Display the cursor back
      this.termOutput.writeMeta(cursor.normal);

      // Enable the terminal soft wrapping
      this.termOutput.writeMeta(screen.noWrap.out);

      // Exit the alternate screen
      if (!this.termOutput.isInline) {
        this.termOutput.writeMeta(screen.alternateScreen.out);
      }

      if (this.termOutput.isInline) {
        this.termOutput.write(cursor.moveTo({x: 0, y: this.inlineTop}));
        this.termOutput.write(screen.clearBelow);
      }
    });

    this.termInput.close();
    this.termOutput.close();

    this.opened = false;
  }

  render(tree: NodeTree) {
    if (!this.opened)
      return;

    this.termOutput.buffer(() => {
      if (!this.opened)
        this.open();

      const oldHeight = tree.elementRect.height;

      tree.yoga.calculateLayout();

      const dirtyScreen = new DirtyScreen();

      // Update the `.localLayout` property of all the nodes, and extract the rects that need to be redrawn
      tree.propagateLayout(dirtyScreen);

      // Recompute our nodes rendering order, required when one has been added/removed
      const renderList = tree.refreshRenderList();

      // Hide the cursor so that we don't see it moving on the screen
      this.termOutput.write(cursor.hidden);

      // If we detect that we haven't enough space to print the interface, we reserve a few more lines by outputting line returns
      if (this.termOutput.rows - this.inlineTop < tree.elementRect.height) {
        this.termOutput.write(cursor.moveTo({ x: 0, y: this.inlineTop }));
        this.termOutput.write(`\n`.repeat(tree.elementRect.height - 1));
        this.inlineTop = this.termOutput.rows - tree.elementRect.height;
      }

      // If the display shrinked, we must clear the lines below
      if (oldHeight > tree.elementRect.height) {
        this.termOutput.write(cursor.moveTo({x: 0, y: this.inlineTop + tree.elementRect.height }));
        this.termOutput.write(screen.clearBelow);
      }

      // Render all lines that have changed
      for (const dirtyRect of dirtyScreen.viewport(tree.elementRect))
        for (let y = dirtyRect.top, Y = dirtyRect.top + dirtyRect.height; y < Y; ++y)
          this.renderLine(renderList, y, dirtyRect.left, dirtyRect.width);

      if (tree.activeElement && tree.activeElement.props.caret) {
        let {left, top} = tree.activeElement.elementWorldRect;

        left += getCaretX(tree.activeElement.props.caret);
        top += getCaretY(tree.activeElement.props.caret);

        if (this.termOutput.isInline)
          top += this.inlineTop;

        this.termOutput.write(cursor.moveTo({x: left, y: top}));
        this.termOutput.write(cursor.normal);
      }
    });
  }

  private renderLine(renderList: Array<Node>, y: number, left: number, width: number) {
    let segments = [{left, width}];

    for (const node of renderList) {
      // We can skip the node entirely if it is not on the same line than the one we're processing
      if (node.elementClipRect.top > y || node.elementClipRect.top + node.elementClipRect.height <= y)
        continue;

      let nextSegments: Array<Segment> = [];

      for (const segment of segments) {
        const overlap = findOverlapingSegment(segment, {
          left: node.elementClipRect.left, width: node.elementClipRect.width,
        });

        // Detects which parts of the segment won't be covered by the node
        if (!overlap) {
          nextSegments.push(segment);
        } else {
          nextSegments = nextSegments.concat(removeSegment(overlap, segment));
        }

        // Generates the rendering code by asking the node
        if (overlap) {
          let top = y;

          if (this.termOutput.isInline)
            top += this.inlineTop;

          const prefix = (``/*/+Date.now()/**/).substr(0, overlap.width);
          const line = prefix + node.getLine(y - node.elementWorldRect.top, overlap.left - node.elementWorldRect.left, Math.max(0, overlap.width - prefix.length));

          this.termOutput.write(cursor.moveTo({x: overlap.left, y: top}));
          this.termOutput.write(line);
        }
      }

      segments = nextSegments;
    }

    if (segments.length > 0) {
      // We can only reach this code if there's no element located over some part of the scanline, not even the root. This doesn't happen under normal circumstances
      throw new Error(`Expected all segments to have been covered (not covered on line ${y}: ${JSON.stringify(segments)})`);
    }
  }

  handleException = (exception: any) => {
    this.close();

    process.stdout.write(exception.stack || exception.message || exception);
    process.stdout.write(exception.stack || exception.message || exception);

    process.exitCode = 1;
  }

  handleExitSignal = () => {
    this.close();

    process.exitCode = 1;
  }

  handleExit = () => {
    this.close();
  }
}
