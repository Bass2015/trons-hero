/**
 * Imports an Ableton Live project (.als) into a song folder:
 *   node scripts/import-als.mjs public/songs/<slug>
 * Reads the first .als in the folder, flattens every MIDI track's arrangement
 * clips, and writes one <line>.mid per line plus song.json.
 * Optional import.json in the folder overrides title, range and track mapping:
 *   { "title": "…", "firstBar": 14, "endBar": 148, "cover": "cover.jpg",
 *     "tracks": { "<Ableton track name>": "surdo" | null |
 *     { "id": "rocar", "name": "Rocar", "role": "hidden", "velocityScale": 0.6 } } }
 * Leading silence is trimmed to the first bar with a note and trailing silence after
 * the last non-click note is dropped; bar labels in the app keep the project's numbers.
 * Requires Node 23.6+ (imports TypeScript sources directly).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';
import { XMLParser } from 'fast-xml-parser';
import { unrollClip, decodeTimeSignature } from '../src/import/unroll.ts';
import { INSTRUMENTS } from '../src/song/instruments.ts';

const require = createRequire(import.meta.url);
const { Midi } = require('@tonejs/midi');

const folder = process.argv[2];
if (!folder) {
  console.error('usage: node scripts/import-als.mjs public/songs/<slug>');
  process.exit(1);
}
const alsFile = readdirSync(folder).find((f) => f.endsWith('.als'));
if (!alsFile) {
  console.error(`no .als file in ${folder}`);
  process.exit(1);
}
const overrides = existsSync(join(folder, 'import.json')) ? JSON.parse(readFileSync(join(folder, 'import.json'), 'utf8')) : {};

// --- parse -----------------------------------------------------------------------
const LIST_TAGS = new Set(['MidiTrack', 'AudioTrack', 'GroupTrack', 'MidiClip', 'KeyTrack', 'MidiNoteEvent', 'AutomationEnvelope', 'FloatEvent']);
const xml = gunzipSync(readFileSync(join(folder, alsFile))).toString('utf8');
const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => LIST_TAGS.has(name), parseAttributeValue: false }).parse(xml);
const liveSet = doc.Ableton.LiveSet;
const main = liveSet.MainTrack ?? liveSet.MasterTrack;
const tempoNode = main.DeviceChain.Mixer.Tempo;
const manualBpm = Number(tempoNode.Manual.Value);
// tempo automation (steps; ramps are subdivided per beat)
const tempoEvents = [];
const targetId = tempoNode.AutomationTarget?.Id;
for (const env of main.AutomationEnvelopes?.Envelopes?.AutomationEnvelope ?? []) {
  if (String(env.EnvelopeTarget?.PointeeId?.Value) !== String(targetId)) continue;
  for (const e of env.Automation?.Events?.FloatEvent ?? []) tempoEvents.push({ time: Number(e.Time), bpm: Number(e.Value) });
}
/** Piecewise tempo in arrangement beats: [{beat, bpm}], first entry is the initial tempo. */
function tempoSteps(events) {
  if (!events.length) return [{ beat: 0, bpm: manualBpm }];
  const steps = [];
  let initial = events.filter((e) => e.time <= 0).at(-1)?.bpm ?? events[0].bpm;
  steps.push({ beat: 0, bpm: initial });
  const later = events.filter((e) => e.time > 0);
  for (let i = 0; i < later.length; i++) {
    const cur = later[i];
    const prev = i ? later[i - 1] : { time: 0, bpm: initial };
    if (cur.time > prev.time && Math.abs(cur.bpm - prev.bpm) > 1e-6) {
      // ramp: one step per beat
      for (let b = Math.ceil(prev.time); b < cur.time; b++) steps.push({ beat: b, bpm: prev.bpm + ((cur.bpm - prev.bpm) * (b - prev.time)) / (cur.time - prev.time) });
    }
    steps.push({ beat: cur.time, bpm: cur.bpm });
  }
  // keep the last value at each beat, drop repeats
  const out = [];
  for (const st of steps) {
    if (out.length && Math.abs(out.at(-1).beat - st.beat) < 1e-9) out[out.length - 1] = st;
    else if (!out.length || Math.abs(out.at(-1).bpm - st.bpm) > 1e-6) out.push(st);
  }
  return out;
}
const tempoMapArr = tempoSteps(tempoEvents);
const bpm = tempoMapArr[0].bpm;
const sig = decodeTimeSignature(Number(main.DeviceChain.Mixer.TimeSignature.Manual.Value));
const beatsPerBar = sig.numerator * (4 / sig.denominator);
const val = (x) => (x && x.Value !== undefined ? x.Value : undefined);
const num = (x) => Number(val(x));

const tracks = (liveSet.Tracks.MidiTrack ?? []).map((tr) => {
  const name = val(tr.Name.EffectiveName);
  const events = tr.DeviceChain?.MainSequencer?.ClipTimeable?.ArrangerAutomation?.Events;
  const clips = (events?.MidiClip ?? []).map((c) => ({
    start: num(c.CurrentStart),
    end: num(c.CurrentEnd),
    loopStart: num(c.Loop.LoopStart),
    loopEnd: num(c.Loop.LoopEnd),
    startRelative: num(c.Loop.StartRelative),
    loopOn: val(c.Loop.LoopOn) === 'true',
    notes: (c.Notes?.KeyTracks?.KeyTrack ?? []).flatMap((kt) =>
      (kt.Notes?.MidiNoteEvent ?? []).map((e) => ({
        time: Number(e.Time),
        duration: Number(e.Duration),
        velocity: Number(e.Velocity),
        pitch: num(kt.MidiKey),
        enabled: e.IsEnabled !== 'false',
      })),
    ),
  }));
  return { name, clips };
});

// --- mapping ---------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
function defaultMapping(name) {
  const n = norm(name);
  if (/^(surdo|contra|goliat|mig|caixa)\b/.test(n)) return { id: n.split(' ')[0] };
  if (/^(repe|replana|repinique)\b/.test(n)) return { id: 'repe' };
  if (/^rocar/.test(n)) return { id: 'rocar', role: 'hidden', velocityScale: /fluix|suau|soft|piano/.test(n) ? 0.6 : 1 };
  if (/^(claqueta|click|metr[oò]nom)/.test(n)) return { id: 'claqueta', name: 'Claqueta', role: 'click' };
  if (/^ferro/.test(n)) return { id: 'ferro', name: 'Ferro', role: 'hidden' };
  return null;
}
function mappingFor(name) {
  const o = overrides.tracks ?? {};
  if (name in o) return o[name] === null ? null : typeof o[name] === 'string' ? { id: o[name] } : o[name];
  return defaultMapping(name);
}

// --- flatten ---------------------------------------------------------------------
const lines = new Map(); // id -> { id, name, role, notes[] }
for (const tr of tracks) {
  const m = mappingFor(tr.name);
  if (!tr.clips.length) continue;
  if (!m) {
    console.warn(`  skip  ${tr.name} (${tr.clips.length} clips): no mapping`);
    continue;
  }
  const inst = INSTRUMENTS.find((i) => i.id === m.id);
  const line = lines.get(m.id) ?? { id: m.id, name: m.name ?? inst?.name ?? tr.name, role: m.role, notes: [] };
  for (const c of tr.clips) line.notes.push(...unrollClip(c, m.id, m.velocityScale ?? 1));
  lines.set(m.id, line);
  console.log(`  ${tr.name.padEnd(14)} -> ${m.id.padEnd(9)} ${m.role ?? 'lane'}  ${line.notes.length} notes so far`);
}
for (const line of lines.values()) {
  line.notes.sort((a, b) => a.beat - b.beat || (a.pitch ?? 0) - (b.pitch ?? 0));
  if (line.role === 'click') {
    // the highest pitch is the accent: normalise velocities so the app can tell them apart
    const top = Math.max(...line.notes.map((n) => n.pitch ?? 0));
    for (const n of line.notes) n.velocity = n.pitch === top ? 1 : 0.7;
  }
}

// --- range: trim leading silence (keeping bar numbers) and trailing silence -----------
const all = [...lines.values()];
const firstBeat = Math.min(...all.flatMap((l) => l.notes.map((n) => n.beat)));
const lastPlayedBeat = Math.max(...all.filter((l) => l.role !== 'click').flatMap((l) => l.notes.map((n) => n.beat)));
const firstBar = overrides.firstBar ?? Math.floor(firstBeat / beatsPerBar) + 1;
const endBar = overrides.endBar ?? Math.floor(lastPlayedBeat / beatsPerBar) + 1; // inclusive, project numbering
const offset = (firstBar - 1) * beatsPerBar;
const endBeat = endBar * beatsPerBar;
for (const l of all) {
  const before = l.notes.length;
  l.notes = l.notes.filter((n) => n.beat >= offset - 1e-9 && n.beat < endBeat - 1e-9).map((n) => ({ ...n, beat: n.beat - offset }));
  if (l.notes.length !== before) console.log(`  trimmed ${before - l.notes.length} notes of ${l.id} outside bars ${firstBar}-${endBar}`);
}

// --- write -----------------------------------------------------------------------
const order = [...INSTRUMENTS.map((i) => i.id), 'ferro', 'claqueta'];
const sorted = all.filter((l) => l.notes.length).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
// tempo map in app beats: collapse everything before the start into the initial tempo
const shifted = tempoMapArr.map((p) => ({ beat: Math.round((p.beat - offset) * 1e6) / 1e6, bpm: Math.round(p.bpm * 1000) / 1000 })).filter((p) => p.beat < endBeat - offset);
const startIdx = Math.max(0, shifted.findLastIndex((p) => p.beat <= 0));
const tempos = [{ beat: 0, bpm: shifted[startIdx].bpm }, ...shifted.slice(startIdx + 1)];
const spec = { title: overrides.title ?? titleCase(basename(alsFile, '.als')), bpm: tempos[0].bpm, beatsPerBar, firstBar, lines: [] };
if (tempos.length > 1) spec.tempos = tempos;
if (tempoEvents.length) console.log(`  tempo automation: ${tempos.map((p) => `${p.bpm} bpm @ bar ${Math.floor(p.beat / beatsPerBar) + firstBar}`).join(', ')}`);
const cover = overrides.cover ?? (existsSync(join(folder, 'cover.jpg')) ? 'cover.jpg' : undefined);
if (cover) spec.cover = cover;
for (const line of sorted) {
  const midi = new Midi();
  midi.header.setTempo(tempos[0].bpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [sig.numerator, sig.denominator], measures: 0 }];
  const track = midi.addTrack();
  track.name = line.name;
  const ppq = midi.header.ppq;
  for (const n of line.notes) track.addNote({ midi: n.pitch ?? 60, ticks: Math.round(n.beat * ppq), durationTicks: Math.max(1, Math.round(n.durationBeats * ppq)), velocity: n.velocity });
  const file = `${line.id}.mid`;
  writeFileSync(join(folder, file), Buffer.from(midi.toArray()));
  const entry = { id: line.id, name: line.name, file };
  if (line.role) entry.role = line.role;
  spec.lines.push(entry);
}
writeFileSync(join(folder, 'song.json'), JSON.stringify(spec, null, 2) + '\n');
const lengthBeats = endBeat - offset;
const seconds = tempos.reduce((acc, p, i) => acc + ((Math.min(tempos[i + 1]?.beat ?? lengthBeats, lengthBeats) - p.beat) * 60) / p.bpm, 0);
console.log(`\n${spec.title}: ${spec.bpm} bpm, ${sig.numerator}/${sig.denominator}, ${sorted.length} lines, project bars ${firstBar}-${endBar} (${Math.round(seconds)} s)`);

function titleCase(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
