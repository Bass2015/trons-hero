/**
 * Display order of the lanes: the player's line in the middle, the other
 * lines around it keeping their lineup order (low on the left, high on the right).
 * Returns line indexes by lane position.
 */
export function laneOrder(lineCount: number, myIndex: number): number[] {
  const others = Array.from({ length: lineCount }, (_, i) => i).filter((i) => i !== myIndex);
  if (myIndex < 0 || myIndex >= lineCount) return others;
  const middle = Math.floor((lineCount - 1) / 2);
  return [...others.slice(0, middle), myIndex, ...others.slice(middle)];
}
