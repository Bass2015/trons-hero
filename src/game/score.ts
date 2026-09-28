import type { Verdict } from './judge';

export class Score {
  perfect = 0;
  good = 0;
  miss = 0;
  streak = 0;
  bestStreak = 0;

  add(v: Verdict) {
    this[v]++;
    if (v === 'miss') {
      this.streak = 0;
    } else {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    }
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
    this.perfect = this.good = this.miss = this.streak = this.bestStreak = 0;
  }
}
