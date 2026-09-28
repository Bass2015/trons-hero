import { describe, expect, it } from 'vitest';
import { laneOrder } from './laneOrder';

describe('laneOrder', () => {
  it('centres the player line and keeps the others in order', () => {
    expect(laneOrder(6, 5)).toEqual([0, 1, 5, 2, 3, 4]);
    expect(laneOrder(6, 0)).toEqual([1, 2, 0, 3, 4, 5]);
    expect(laneOrder(5, 4)).toEqual([0, 1, 4, 2, 3]);
    expect(laneOrder(2, 1)).toEqual([1, 0]);
    expect(laneOrder(1, 0)).toEqual([0]);
  });

  it('falls back to lineup order when the player line is unknown', () => {
    expect(laneOrder(3, -1)).toEqual([0, 1, 2]);
  });
});
