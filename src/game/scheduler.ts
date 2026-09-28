import type { AudioEngine } from '../audio/engine';
import type { Song } from '../song/types';
import type { LineState } from './modes';
import type { Transport } from './transport';

const TICK_MS = 25;
const HORIZON_S = 0.12;

/**
 * Lookahead scheduler. Walks the song in small time slices ahead of the
 * transport and queues sounds on the audio clock. Loop wraps are handled by
 * continuing the walk from the loop start at the exact wrap time.
 */
export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursorBeat = 0;
  private cursorTime = 0;
  metronome = true;

  constructor(
    private engine: AudioEngine,
    private transport: Transport,
    private song: Song,
    private lineState: (lineId: string) => LineState,
  ) {}

  start() {
    this.resync();
    this.stop();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Re-derives the cursor from the transport, e.g. after a rate change or a fresh start. */
  resync() {
    const t = this.transport;
    const cur = t.currentBeat();
    if (this.timer === null) {
      this.cursorBeat = cur;
      this.cursorTime = t.timeAt(cur);
      return;
    }
    // Rate changed mid-play: keep the already scheduled beats, recompute their time.
    if (this.cursorBeat >= cur || !t.loop) {
      this.cursorBeat = Math.max(this.cursorBeat, cur);
      this.cursorTime = t.timeAt(this.cursorBeat);
    } else {
      // cursor already wrapped into the next loop pass
      this.cursorTime = t.timeAt(t.loopEndBeat) + (this.cursorBeat - t.loopStartBeat) * t.secondsPerBeat;
    }
  }

  private tick() {
    const t = this.transport;
    if (t.state !== 'playing') return;
    const endTime = this.engine.now + HORIZON_S;
    let guard = 0;
    while (this.cursorTime < endTime && guard++ < 8) {
      const spb = t.secondsPerBeat;
      const segEndBeat = t.loop ? t.loopEndBeat : t.lengthBeats + 1e-6;
      if (this.cursorBeat >= segEndBeat) {
        if (!t.loop) return; // song over, nothing more to schedule
        this.cursorBeat = t.loopStartBeat;
      }
      const segEndTime = this.cursorTime + (segEndBeat - this.cursorBeat) * spb;
      const sliceEndTime = Math.min(endTime, segEndTime);
      const sliceEndBeat = sliceEndTime >= segEndTime ? segEndBeat : this.cursorBeat + (sliceEndTime - this.cursorTime) / spb;
      this.scheduleSlice(this.cursorBeat, sliceEndBeat, this.cursorTime, spb);
      if (sliceEndTime >= segEndTime && t.loop) {
        this.cursorBeat = t.loopStartBeat;
      } else {
        this.cursorBeat = sliceEndBeat;
      }
      this.cursorTime = sliceEndTime;
    }
  }

  private scheduleSlice(fromBeat: number, toBeat: number, fromTime: number, spb: number) {
    if (toBeat <= fromBeat) return;
    const timeOf = (beat: number) => fromTime + (beat - fromBeat) * spb;
    // metronome and count-in clicks on every beat
    if (this.metronome || fromBeat < 0) {
      for (let b = Math.ceil(fromBeat - 1e-9); b < toBeat; b++) {
        if (b >= this.song.lengthBeats) break;
        if (!this.metronome && b >= 0) break;
        const accent = ((b % this.song.beatsPerBar) + this.song.beatsPerBar) % this.song.beatsPerBar === 0;
        this.engine.playClick(timeOf(b), accent);
      }
    }
    for (const line of this.song.lines) {
      if (this.lineState(line.id) !== 'auto') continue;
      for (const n of line.notes) {
        if (n.beat < fromBeat) continue;
        if (n.beat >= toBeat) break;
        this.engine.playNote(line.id, timeOf(n.beat), n.velocity);
      }
    }
  }
}
