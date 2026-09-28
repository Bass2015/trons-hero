import type { Verdict } from './judge';

export class Score {
  perfect = 0;
  good = 0;
  miss = 0;
  streak = 0;
  bestStreak = 0;
  points = 0;

  /** x1 to x4, one step every 10 consecutive hits. */
  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.streak / 10));
  }

  /** Records a verdict and returns the points it earned. */
  add(v: Verdict): number {
    this[v]++;
    if (v === 'miss') {
      this.streak = 0;
      return 0;
    }
    const earned = (v === 'perfect' ? 100 : 50) * this.multiplier;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.points += earned;
    return earned;
  }

  get judged() {
    return this.perfect + this.good + this.miss;
  }

  /** 0..100, perfect counts full, good counts half. */
  get accuracy() {
    if (this.judged === 0) return 100;
    return Math.round(((this.perfect + this.good * 0.5) / this.judged) * 100);
  }

  reset() {
    this.perfect = this.good = this.miss = this.streak = this.bestStreak = this.points = 0;
  }
}
