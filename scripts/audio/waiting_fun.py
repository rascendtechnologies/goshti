"""GOSHTI waiting song, short version with a FUN interlude (no flute): two lines, a bouncy
marimba/xylophone phrase on the song's own 0.8 s pulse, the same two lines again, a little sparkle.

    python3 scripts/audio/waiting_fun.py song song.wav OUT.wav
    python3 scripts/audio/waiting_fun.py voice manjiri.wav OUT.wav song.wav   # song.wav only sets the level

The song's tanpura plucks every 0.8 s from its start, so the interlude starts on that grid
(a whole number of 0.8 s after the first line begins) and the repeat starts on it too.
Everything is synthesised here; the tune is written for GOSHTI.
"""
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

from flute import FS, midi as M

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




def xylo(m, dur=0.5, bright=1.0, seed=0):
    """A wooden bar: a soft strike, a 4x partial that dies quickly, a short warm ring."""
    f = hz(m); N = int(dur * FS); t = np.arange(N) / FS
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.20)
         + 0.45 * bright * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.06)
         + 0.12 * bright * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.03))
    return y * np.minimum(1, t / 0.002)


def shaker(dur=0.12, seed=0):
    r = np.random.default_rng(seed); N = int(dur * FS); t = np.arange(N) / FS
    x = sosfilt(butter(2, [4500, 9000], btype='band', fs=FS, output='sos'), r.standard_normal(N))
    return x * np.exp(-t / 0.03) * np.minimum(1, t / 0.004)


def bounce(start, notes, level, dst):
    """notes: (midi or None, eighth-notes of 0.4 s). Plays them from `start`."""
    t = start
    for m, e in notes:
        if m is not None:
            add(dst, xylo(m, 0.6 if e > 1 else 0.4), t, level)
        t += e * 0.4

mode, path, out = sys.argv[1], sys.argv[2], sys.argv[3]
INTRO = 4 * BEAT
PULSE = 0.8

if mode == 'song':
    song, fs = sf.read(path); assert fs == FS
    song = song.mean(axis=1) if song.ndim > 1 else song
    seg = song[:int(10.3 * FS)].copy(); seg[-int(0.2 * FS):] *= np.linspace(1, 0, int(0.2 * FS))  # lines 1 and 2 only
    vocal_level = active_rms(seg)
else:
    ref, _ = sf.read(sys.argv[4]) if len(sys.argv) > 4 else (None, None)
    voice, fs = sf.read(path); assert fs == FS
    voice = voice.mean(axis=1) if voice.ndim > 1 else voice
    voice = sosfilt(butter(2, 80, btype='high', fs=FS, output='sos'), voice)
    w = int(0.05 * FS)
    env = np.array([np.sqrt(np.mean(voice[i:i + w] ** 2)) for i in range(0, len(voice) - w, w)])
    idx = np.where(env > env.max() * 0.12)[0]
    s0 = max(0, idx[0] * w - int(0.15 * FS)); e0 = min(len(voice), (idx[-1] + 1) * w + int(0.25 * FS))
    seg = fade(voice[s0:e0], 0.08, 0.35)
    ref = ref.mean(axis=1) if ref is not None and ref.ndim > 1 else ref
    vocal_level = active_rms(ref[:int(10.3 * FS)]) if ref is not None else 0.12
    seg = seg / active_rms(seg) * vocal_level
    ir_t = np.arange(int(0.7 * FS)) / FS
    ir = sosfilt(butter(2, 5000, btype='low', fs=FS, output='sos'), rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.18))
    wet = fftconvolve(seg, ir)[:len(seg) + int(0.7 * FS)] * 0.012
    seg = np.concatenate([seg, np.zeros(len(wet) - len(seg))]) + wet
SEG = len(seg) / FS

T1 = 0.0
T_FLUTE = np.ceil((SEG + 0.05) / PULSE) * PULSE   # the interlude lands on the song's own pulse
T2 = T_FLUTE + INTRO
T_END = T2 + SEG - 0.3
mix = np.zeros(int((T_END + 5.0) * FS))

def place(t):
    add(mix, seg, t)
    if mode == 'song':
        # a small bouncy reply after line 1, landing on F as the chord moves to B-flat
        bounce(t + 4.6, [(70, .5), (68, .5), (67, .5), (65, 1.5)], 0.9 * vocal_level, mix)
    else:
        dr = pad([hz(51), hz(58), hz(63)], SEG + 1.0, a=1.0, r=1.5)
        add(mix, dr / rms(dr) * vocal_level * 10 ** (-22 / 20), max(0.0, t - 0.1))

place(T1); place(T2)
# the fun interlude: 4 pulses (3.2 s) — wood-bar tune, plucked bass on the beat, a shaker on the off-beat
for k in range(4):
    add(mix, pluck(hz([51, 46, 51, 46][k]), 1.2, damp=0.999, bright=0.5), T_FLUTE + k * PULSE, 0.5 * vocal_level)
    add(mix, shaker(seed=k), T_FLUTE + k * PULSE + 0.4, 0.9 * vocal_level)
    add(mix, shaker(0.06, seed=9 + k), T_FLUTE + k * PULSE, 0.25 * vocal_level)
bounce(T_FLUTE, [(75, 1), (79, 1), (82, 1), (79, 1), (80, 1), (77, 1), (79, 2)], 2.4 * vocal_level, mix)
# the ending: a quick climb and a ring
for i, m in enumerate([79, 82, 87]):
    add(mix, xylo(m, 2.4 if i == 2 else 0.5), T_END + i * 0.22, 1.8 * vocal_level)

mix = mix[:int((T_END + 3.4) * FS)]
mix[-int(0.6 * FS):] *= np.linspace(1, 0, int(0.6 * FS))
mix /= np.max(np.abs(mix)) / 0.9
sf.write(out, mix, FS)
print(f'{mode}: {len(mix) / FS:.1f}s (lines {SEG:.1f}s, flute at {T_FLUTE:.1f}s, repeat at {T2:.1f}s)')
