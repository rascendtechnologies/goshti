"""GOSHTI waiting song, version with Manjiri's own voice.

    python3 scripts/audio/waiting_combo.py song.wav manjiri.wav OUT.wav

song.wav    = the current waiting song (Rohan's sung song with its accompaniment, E-flat), mono 44.1 kHz
manjiri.wav = Manjiri's recording (two sung phrases, no music), mono 44.1 kHz

Order: the Canon flute opening -> the song's FIRST line (with its small flute reply)
       -> a flute interlude (Pachelbel's Canon, public domain, over its own chords in E-flat)
       -> Manjiri's line (a very quiet E-flat drone under it) -> a soft lifting flute ending.
"""
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

from flute import FS, midi as M, render

rng = np.random.default_rng(5)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
BEAT = 0.8
n = lambda name, beats, *how: (M(name), beats, *how)
CANON = [(51, (63, 67, 70)), (46, (58, 62, 65)), (48, (60, 63, 67)), (43, (55, 58, 62)),
         (44, (56, 60, 63)), (39, (51, 55, 58)), (44, (56, 60, 63)), (46, (58, 62, 65))]


def pluck(f, dur, damp=0.9995, bright=0.35):
    N = int(dur * FS); L = max(2, int(FS / f)); buf = rng.uniform(-1, 1, L)
    for _ in range(2):
        buf[1:] = buf[1:] * bright + buf[:-1] * (1 - bright)
    out = np.zeros(N); i = 0
    for k in range(N):
        j = (i + 1) % L; v = buf[i]; buf[i] = damp * 0.5 * (v + buf[j]); out[k] = v; i = j
    return out


def pad(freqs, dur, a=1.2, r=1.5):
    N = int(dur * FS); t = np.arange(N) / FS; y = np.zeros(N)
    for f in freqs:
        for d in (0.997, 1.003):
            ph = rng.random() * 6.28
            y += np.sin(2 * np.pi * f * d * t + ph) + 0.15 * np.sin(4 * np.pi * f * d * t + ph)
    return y / (2 * len(freqs)) * np.clip(np.minimum(t / a, (dur - t) / r), 0, 1)


def add(dst, src, at, g=1.0):
    s = int(at * FS); e = min(len(dst), s + len(src))
    if e > s:
        dst[s:e] += src[:e - s] * g


def canon_bed(dst, start, beats, level=1.0):
    for i in range(beats):
        bass, triad = CANON[i % 8]
        at = start + i * BEAT
        add(dst, pluck(hz(bass), 2.4, damp=0.9993, bright=0.4), at, 0.32 * level)
        add(dst, pad([hz(m) for m in triad], BEAT * 1.6, a=0.18, r=0.7), at, 0.42 * level)


def rms(x):
    x = x[np.abs(x) > 1e-4]
    return np.sqrt(np.mean(x ** 2)) if len(x) else 1.0


def active_rms(x, thresh_db=-30):
    """Loudness of the voiced parts only (ignores pauses and the quiet before/after)."""
    w = int(0.05 * FS)
    fr = [np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)]
    peak = max(fr)
    loud = [v for v in fr if v > peak * 10 ** (thresh_db / 20)]
    return float(np.mean(loud))


def fade(x, a=0.05, b=0.2):
    x = x.copy(); na, nb = int(a * FS), int(b * FS)
    x[:na] *= np.linspace(0, 1, na); x[-nb:] *= np.linspace(1, 0, nb)
    return x


song, fs = sf.read(sys.argv[1]); assert fs == FS
voice, fs2 = sf.read(sys.argv[2]); assert fs2 == FS
if song.ndim > 1: song = song.mean(axis=1)
if voice.ndim > 1: voice = voice.mean(axis=1)

INTRO = 4 * BEAT        # 3.2 s Canon opening
LINE1 = 5.15            # the song's first line ends before line 2 begins (5.25 s)
line1 = fade(song[:int(LINE1 * FS)], 0.0 + 1e-3, 0.12)
vocal_level = active_rms(line1)

# --- Manjiri's line: the two sung phrases, trimmed, tidied and matched to the song's loudness
sos = butter(2, 80, btype='high', fs=FS, output='sos')
voice = sosfilt(sos, voice)
env_w = int(0.05 * FS)
env = np.array([np.sqrt(np.mean(voice[i:i + env_w] ** 2)) for i in range(0, len(voice) - env_w, env_w)])
idx = np.where(env > env.max() * 0.12)[0]
start = max(0, idx[0] * env_w - int(0.15 * FS)); end = min(len(voice), (idx[-1] + 1) * env_w + int(0.25 * FS))
hers = fade(voice[start:end], 0.08, 0.35)
hers = hers / active_rms(hers) * vocal_level
# a little room, like the song's own voice
ir_t = np.arange(int(0.7 * FS)) / FS
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.18)
ir = sosfilt(butter(2, 5000, btype='low', fs=FS, output='sos'), ir)
wet = fftconvolve(hers, ir)[:len(hers) + int(0.7 * FS)] * 0.012
hers = np.concatenate([hers, np.zeros(len(wet) - len(hers))]) + wet
hers_len = len(hers) / FS

# --- timeline
T_LINE1 = INTRO
T_INTER = T_LINE1 + LINE1 + 0.85          # the flute reply finishes first
INTER_BEATS = 8
T_HERS = T_INTER + INTER_BEATS * BEAT
T_END_FLUTE = T_HERS + hers_len - 0.3
total = T_END_FLUTE + 5.0
mix = np.zeros(int(total * FS))

# 1) Canon opening bed + flute, then the song's first line with its small reply
bed = np.zeros(int((INTRO + 1.6) * FS)); canon_bed(bed, 0.0, 4)
bed *= np.clip((INTRO + 1.2 - np.arange(len(bed)) / FS) / 1.2, 0, 1)
add(mix, bed / rms(bed) * vocal_level * 10 ** (-10 / 20), 0.0)
add(mix, line1, T_LINE1)
parts = [
    (0.15, [n('G5', 1), n('F5', 1), n('Eb5', 1), n('D5', 1), n('Eb5', 0.9, 'slide')], BEAT, -4, 20),
    (T_LINE1 + 4.6, [n('Bb5', 0.25), n('Ab5', 0.2), n('G5', 0.2), n('F5', 0.6, 'slide')], 1.0, -7, 21),
]
# 2) interlude: the Canon's second line over its chords (ends resting on F, leading home to E-flat)
inter = [n('Eb5', 1), n('D5', 1), n('C5', 1), n('Bb4', 1), n('Ab4', 1), n('G4', 1), n('Ab4', 1), n('F4', .8, 'slide'), (None, .2)]
assert abs(sum(x[1] for x in inter) - 8) < 1e-9
ib = np.zeros(int((INTER_BEATS * BEAT + 1.2) * FS)); canon_bed(ib, 0.0, INTER_BEATS)
ib *= np.clip(np.minimum(np.arange(len(ib)) / FS / 0.05, (INTER_BEATS * BEAT + 1.0 - np.arange(len(ib)) / FS) / 1.0), 0, 1)
add(mix, ib / rms(ib) * vocal_level * 10 ** (-10 / 20), T_INTER)
parts.append((T_INTER, inter, BEAT, -4, 22))
# 3) a very quiet E-flat / B-flat drone under her line (no third, so it can't clash)
drone = pad([hz(51), hz(58), hz(63)], hers_len + 1.0, a=1.0, r=1.5)
add(mix, drone / rms(drone) * vocal_level * 10 ** (-22 / 20), T_HERS - 0.2)
add(mix, hers, T_HERS)
# 4) the song's own lifting ending
parts.append((T_END_FLUTE, [n('G5', 0.4), n('Bb5', 0.4), n('Eb6', 1.9, 'slide')], 1.0, -5, 23))
for at, notes, beat, db, seed in parts:
    f = render(notes, beat=beat, seed=seed)
    add(mix, f / rms(f) * vocal_level * 10 ** (db / 20), at)

mix = mix[:int((T_END_FLUTE + 4.8) * FS)]
mix[-int(0.6 * FS):] *= np.linspace(1, 0, int(0.6 * FS))
mix /= np.max(np.abs(mix)) / 0.9
sf.write(sys.argv[3], mix, FS)
print(f'combined: {len(mix) / FS:.1f}s  (line 1 at {T_LINE1:.1f}s, flute interlude at {T_INTER:.1f}s, her line at {T_HERS:.1f}s, ends {T_END_FLUTE:.1f}s)')
