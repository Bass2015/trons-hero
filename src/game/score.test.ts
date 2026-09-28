import { describe, expect, it } from 'vitest';
import { Score } from './score';

describe('Score', () => {
  it('awards points with a combo multiplier', () => {
    const s = new Score();
    expect(s.add('perfect')).toBe(100);
    expect(s.add('good')).toBe(50);
    for (let i = 0; i < 8; i++) s.add('perfect'); // streak 10
    expect(s.multiplier).toBe(2);
    expect(s.add('perfect')).toBe(200);
    expect(s.streak).toBe(11);
  });

  it('resets streak but not points on a miss', () => {
    const s = new Score();
    s.add('perfect');
    expect(s.add('miss')).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(1);
    expect(s.points).toBe(100);
    expect(s.accuracy).toBe(50);
  });
});
