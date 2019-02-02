import {Rect} from './Rect';

type DirtySegment = {
  start: number,
  end: number,
};

class DirtyRow {
  private segments: Array<DirtySegment> = [];

  add(start: number, end: number) {
    if (end <= start)
      return;

    let startIndex = 0;

    // Find the index of the first segment that doesn't end before our starting point
    while (startIndex < this.segments.length && start > this.segments[startIndex].end)
      startIndex += 1;

    // If all segments end before we even start, we can just push the new segment at the end of the list
    if (startIndex === this.segments.length) {
      this.segments.push({ start, end });
    } else {
      const startSegment = this.segments[startIndex];

      // If the segment we found starts only after we even end, we just have to insert ourselves before it (we've already proven that the previous segment ends before we start, so no merge)
      if (startSegment.start > end) {
        this.segments.splice(startIndex, 0, { start, end });
      } else {
        startSegment.start = Math.min(startSegment.start, start);
        startSegment.end = Math.max(startSegment.end, end);

        const spliceIndex = startIndex + 1;
        let spliceSize = 0;

        // Find the number of segments that are fully covered by our new segment ...
        while (spliceIndex + spliceSize < this.segments.length && this.segments[spliceIndex + spliceSize].end <= startSegment.end)
          spliceSize += 1;

        // ... and remove them (since they have been merged)
        this.segments.splice(spliceIndex, spliceSize);

        // There's a special case: the next segment might starts at the very position we stop, in which case we can merge them
        if (startIndex + 1 < this.segments.length && this.segments[startIndex + 1].start === startSegment.start) {
          startSegment.end = this.segments[startIndex + 1].end;
          this.segments.splice(startIndex + 1, 1);
        }
      }
    }
  }

  [Symbol.iterator]() {
    return this.segments[Symbol.iterator]();
  }
}

export class DirtyScreen {
  private rows: Map<number, DirtyRow> = new Map();

  addCoordinates(left: number, top: number, width: number, height: number) {
    if (width === 0 || height === 0)
      return;

    for (let y = top; y < top + height; ++y) {
      let row = this.rows.get(y);
      if (!row) this.rows.set(y, row = new DirtyRow());

      row.add(left, left + width);
    }
  }

  addRect(rect: Rect) {
    this.addCoordinates(rect.left, rect.top, rect.width, rect.height);
  }

  *[Symbol.iterator]() {
    for (const [y, row] of this.rows.entries()) {
      for (const {start, end} of row) {
        yield {left: start, top: y, width: end - start, height: 1};
      }
    }
  }

  *viewport(rect: Rect) {
    for (const [y, row] of this.rows.entries()) {
      if (y < rect.top || y >= rect.top + rect.height)
        continue;

      for (let {start, end} of row) {
        if (start < rect.left)
          start = rect.left;

        if (end > rect.left + rect.width)
          end = rect.left + rect.width;

        if (start === end)
          continue;

        yield {left: start, top: y, width: end - start, height: 1};
      }
    }
  }
}
