"""GOSHTI waiting song, short version: two lines, the Canon flute, the same two lines again.

    python3 scripts/audio/waiting_repeat.py song song.wav OUT.wav
    python3 scripts/audio/waiting_repeat.py voice manjiri.wav OUT.wav   # --song song.wav for the level

song   = the first two lines of the current waiting song (with its music and its small flute reply)
voice  = Manjiri's two phrases (no music; a very quiet E-flat drone under them)
Both: lines -> the Canon flute from the opening (Pachelbel, public domain) -> the same lines again
-> the soft lifting flute ending.
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



mode, path, out = sys.argv[1], sys.argv[2], sys.argv[3]
INTRO = 4 * BEAT
GAP = 0.25

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
T_FLUTE = T1 + SEG + GAP
T2 = T_FLUTE + INTRO
T_END = T2 + SEG - 0.3
mix = np.zeros(int((T_END + 5.0) * FS))

def place(t):
    add(mix, seg, t)
    if mode == 'song':
        f = render([n('Bb5', 0.25), n('Ab5', 0.2), n('G5', 0.2), n('F5', 0.6, 'slide')], beat=1.0, seed=21)
        add(mix, f / rms(f) * vocal_level * 10 ** (-7 / 20), t + 4.6)
    else:
        dr = pad([hz(51), hz(58), hz(63)], SEG + 1.0, a=1.0, r=1.5)
        add(mix, dr / rms(dr) * vocal_level * 10 ** (-22 / 20), max(0.0, t - 0.1))

place(T1); place(T2)
# the Canon flute from the opening, over its own chords
bed = np.zeros(int((INTRO + 1.6) * FS)); canon_bed(bed, 0.0, 4)
bed *= np.clip((INTRO + 1.2 - np.arange(len(bed)) / FS) / 1.2, 0, 1)
add(mix, bed / rms(bed) * vocal_level * 10 ** (-10 / 20), T_FLUTE)
f = render([n('G5', 1), n('F5', 1), n('Eb5', 1), n('D5', 1), n('Eb5', 0.9, 'slide')], beat=BEAT, seed=20)
add(mix, f / rms(f) * vocal_level * 10 ** (-4 / 20), T_FLUTE + 0.15)
# the soft lifting ending
f = render([n('G5', 0.4), n('Bb5', 0.4), n('Eb6', 1.9, 'slide')], beat=1.0, seed=23)
add(mix, f / rms(f) * vocal_level * 10 ** (-5 / 20), T_END)

mix = mix[:int((T_END + 4.6) * FS)]
mix[-int(0.6 * FS):] *= np.linspace(1, 0, int(0.6 * FS))
mix /= np.max(np.abs(mix)) / 0.9
sf.write(out, mix, FS)
print(f'{mode}: {len(mix) / FS:.1f}s (lines {SEG:.1f}s, flute at {T_FLUTE:.1f}s, repeat at {T2:.1f}s)')
