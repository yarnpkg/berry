import {Rect}    from './Rect';
import {Segment} from './Segment';

/**
 * Returns a new rectangle big enough to contain both A and B.
 */
export function composeRectangles(a: Rect, b: Rect) {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);

  const width = Math.max(a.left + a.width, b.left + b.width) - left;
  const height = Math.max(a.top + a.height, b.top + b.height) - top;

  return {left, top, width, height};
}

/**
 * Returns the segment that represents the overlaping part of segments A and B.
 */
export function findOverlapingSegment(a: Segment, b: Segment) {
  const left = Math.max(a.left, b.left);
  const width = Math.min(a.left + a.width, b.left + b.width) - left;

  if (width <= 0)
    return null;

  return {left, width};
}

/**
 * Remove a segment A from another B, and returns an array containing the 0, 1, or 2 segments that remain.
 */
export function removeSegment(a: Segment, b: Segment) {
  const overlap = findOverlapingSegment(a, b);

  if (!overlap)
    return [b];

  const remains = [];

  if (overlap.left > b.left)
    remains.push({left: b.left, width: overlap.left - b.left});

  if (overlap.left + overlap.width < b.left + b.width)
    remains.push({left: overlap.left + overlap.width, width: b.left + b.width - overlap.left - overlap.width});

  return remains;
}

/**
 * Compute the rectangle that both A and B cover, and store it into the specified destination rect.
 */
export function computeInPlaceIntersectingRect(destination: Rect, a: Rect, b: Rect) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);

  destination.width = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - left);
  destination.height = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - top);

  destination.left = left;
  destination.top = top;
}
