# Export everything the heel-raise page uses from the SAME-Limb dataset (Hugging Face
# Tdongxu/A_Synchronized_Lower_Limb_AMG_sEMG_and_Mocap, tag v2.0.3, commit 0b674b5;
# doi:10.57967/hf/9950; CC BY 4.0) to one JSON for scripts/heel-raise/build-heel-raise.mjs
# (docs/movement-mechanics/heel-raise/CONSENSUS.md §2–§6).
#   python3 -I scripts/heel-raise/export-same-limb.py <SAME-Limb root> same-limb.json   (needs numpy, scipy)
# The root holds metadata/trials.csv, data/trials/<user>/functional_action/heel_raise/A1–A4.npz,
# data/trials/<user>/treadmill_walking/treadmill_walking_4_kmh/A1–A4.npz (3 and 5 km/h: A1) and,
# optionally, the manifest-<condition>.csv files written when the trials were fetched (LFS SHA-256).
# NPZ files are opened with allow_pickle=False. Fixed definitions (CONSENSUS §4, §6; the same text
# is written to the export's `definitions` block):
#  - Filters: every "4th-order Butterworth, zero phase" below is scipy butter(4, fc, output='sos')
#    applied forward and backward once (sosfiltfilt; magnitude squared, −6 dB at fc). Notches are
#    iirnotch(f, Q = 30) applied with filtfilt.
#  - MoCap: duplicate timestamps dropped (first kept), |value| > 9e5 or non-finite = missing, linear
#    resampling to a uniform 90 Hz grid starting at the first motion sample, 4th-order Butterworth
#    low-pass 6 Hz, zero phase. Z is up (mm). Dataset joint angles: invalid-mask samples dropped, same
#    resampling and filter. Sagittal forward axis per repetition: horizontal, perpendicular to
#    R.ASIS→L.ASIS, pointing from V.Sacral toward the ASIS midpoint (median over the quiet window).
#  - Repetition windows: with cue records, cue i → cue i+1 − 0.5 s (last: trial end). Without cue
#    records (user05, user14, user20): the three highest peaks (≥ 20 mm, ≥ 2.5 s apart) of the
#    two-leg mean heel rise over the whole-trial median, split at the midpoints between peaks.
#  - Quiet window Wq: the 0.5 s before the auditory cue. Subjects without cue records: a pseudo cue at
#    the preliminary heel-off (baseline: the first 0.5 s of the repetition window) minus the median cue→heel-off time of the
#    repetitions with cue records (1.0019 s). A repetition whose Wq would start before the trial has
#    no quiet reference and is dropped from every value and counted (reason 'no quiet window').
#  - Heel events per leg: heel-marker height minus its Wq median; heel-off = last upward crossing of
#    5 mm before that leg's highest sample in the repetition window, contact = first downward crossing
#    after it (linear interpolation between samples); sensitivity 3–10 mm. Repetition events:
#    heel-off and contact = mean of the two legs' crossing times, peak = maximum of the two-leg mean
#    rise (three-point parabolic refinement). A repetition counts when its two-leg mean peak rise is
#    at least 20 mm and both legs have both crossings.
#  - EMG (left leg; RF, VM, TA, GA): semg_preprocessed_basic (20–450 Hz band-pass only) → IIR notch
#    (Q = 30) at 50, 100, …, 450 Hz, zero phase → full-wave rectification → 4th-order Butterworth
#    low-pass 6 Hz, zero phase (envelope, µV). No resampling of the 1000 Hz EMG clock.
#  - Onset (TA; GA for the order check): first sample t from s0 = min(cue, heel-off − 1.2 s) to the
#    peak at which the envelope stays above mean + k·SD of Wq (k = 3; sensitivity 2, 4) for 25
#    consecutive samples (25 ms); the onset is the first sample of that run. Dropped and counted:
#    'edge' = the envelope is already above the threshold at s0; 'beforeCue' = the onset falls before
#    the cue (pseudo cue without cue records), i.e. inside or before the baseline window, so it cannot
#    be a response to the cue; 'after' = onset after heel-off; 'missing' = no run before the peak;
#    'window' = s0 before the EMG record. Sensitivity record: the same onsets without the notch.
#  - Time normalisation: quiet = the 0.5 s before the onset (real time, 51 points); anticipatory =
#    onset → heel-off, rise = heel-off → peak, lowering = peak → contact (101 points each). Per
#    subject the repetitions are averaged, then the subjects; left and right legs are averaged.
#    Repetitions without a valid onset enter the rise and lowering segments only.
#  - Angles (changes from the Wq median, degrees, sagittal projection): shank = Ankle→Knee line,
#    thigh = Knee→Thigh line (forward tilt of the upper end +), pelvis tilt = V.Sacral→ASIS-midpoint
#    line (anterior +), heel–toe line pitch (heel up +; 3D elevation and sagittal projection), dataset
#    knee and ankle angle columns (joint_angles_deg: knee flexion +, ankle interior angle; ankle
#    changes are reported with plantarflexion negative). Hip (drawn) = pelvis − thigh (build script).
#  - Walking reference: treadmill 4 km/h A1–A4 per subject. Left heel strike = local maximum of the
#    forward position of L.Heel relative to V.Sacral (low-passed; peaks ≥ 0.6 s apart, prominence
#    ≥ 80 mm); cycles 0.75–1.25 × the trial median duration; each cycle's envelope resampled to 101
#    points; the mean cycle's maximum = 100. Sensitivity: A1 only at 3, 4 and 5 km/h; reference =
#    mean of the per-cycle maxima.
#  - Phase means: real-time mean of the envelope over Q (0.5 s before the onset), A (onset →
#    heel-off), R (heel-off → peak), L (peak → contact), as % of that subject's reference; mean over
#    the subject's repetitions, then mean (and median) over subjects.
#  - Crosstalk sensitivity: subjects whose walking TA mean-cycle maximum lies at 16–54% of the cycle
#    (mid/late stance, where GA peaks) are listed; the TA and GA tables, the onset lead and the order
#    share are also given without them, with each subject's TA–GA correlation (walking mean cycle;
#    heel raise envelopes from heel-off − 1.2 s to contact).
#  - Mains share: power spectrum of each valid repetition's Wq (0.5 s, periodogram with a Hann
#    window, constant detrend) before and after the notch; share = power within ±2 Hz of 50, 100, …,
#    450 Hz over power in 20–450 Hz; mean per subject, then the median over subjects. Variants:
#    rectangular window; the earlier A1-repetition-1 1.5 s Welch estimate.
#  - Circle fit: algebraic least-squares circle through the right heel marker (sagittal plane) from
#    heel-off to the peak; sweep = unwrapped angle change.
#  - Files: SHA-256 of every file read; npz files against the fetch manifests' LFS SHA-256,
#    metadata/trials.csv against its git blob id in the v2.0.3 tree (TRIALS_CSV_BLOB).
import sys, os, csv, json, hashlib
import numpy as np
from scipy import signal

ROOT, OUT = sys.argv[1], sys.argv[2]
FS_M, FS_E = 90.0, 1000.0
THR_MM = 5.0
THR_SENS = [3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
K_SD = [2.0, 3.0, 4.0]
K_MAIN = 3.0
SUSTAIN = 0.025
SEARCH_LEAD = 1.2
QUIET = 0.5
MIN_PEAK = 20.0
CH = ['RF', 'VM', 'TA', 'GA']
N_SEG = 101
N_Q = 51
# git blob id of metadata/trials.csv in the v2.0.3 tree (Hugging Face tree API, commit 0b674b5);
# trials.csv is a plain git file, not an LFS object.
TRIALS_CSV_BLOB = '57a84c5552dff78ecda90c64bdfda80d09f25d01'
CROSSTALK_BIN = (16, 54)

read_files = {}
def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()
def git_blob(path):
    b = open(path, 'rb').read()
    return hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
def note_file(path):
    rel = os.path.relpath(path, ROOT)
    if rel not in read_files: read_files[rel] = sha(path)

trials_csv = os.path.join(ROOT, 'metadata', 'trials.csv')
note_file(trials_csv)
TRIALS = {r['trial_key']: r for r in csv.DictReader(open(trials_csv, newline=''))}
USERS = sorted({r['subject_id'] for r in TRIALS.values()})

def load(rel):
    path = os.path.join(ROOT, rel)
    note_file(path)
    return np.load(path, allow_pickle=False)

LP_M = signal.butter(4, 6.0, fs=FS_M, output='sos')
LP_E = signal.butter(4, 6.0, fs=FS_E, output='sos')
NOTCH = [signal.iirnotch(50.0 * k, 30.0, fs=FS_E) for k in range(1, 10)]

def motion(f):
    t = f['time_motion_s'].astype(float)
    M = f['motion_markers_named'].astype(float)
    names = [str(x) for x in f['motion_marker_names']]
    keep = np.concatenate([[True], np.diff(t) > 0])
    dups = int((~keep).sum())
    t, M = t[keep], M[keep]
    M[~np.isfinite(M) | (np.abs(M) > 9e5)] = np.nan
    missing = int(np.isnan(M).any(axis=2).sum())
    grid = np.arange(t[0], t[-1], 1 / FS_M)
    G = np.empty((len(grid),) + M.shape[1:])
    for i in range(M.shape[1]):
        for k in range(3):
            v = M[:, i, k]; ok = np.isfinite(v)
            G[:, i, k] = np.interp(grid, t[ok], v[ok])
    G = signal.sosfiltfilt(LP_M, G, axis=0)
    assert [str(x) for x in f['joint_angle_names']] == ['right_knee_flexion', 'left_knee_flexion', 'right_ankle_angle', 'left_ankle_angle']
    J = f['joint_angles_deg'].astype(float)[keep]
    J[~f['joint_angle_valid_mask'][keep]] = np.nan
    JA = np.empty((len(grid), 4))
    for c in range(4):
        ok = np.isfinite(J[:, c]); JA[:, c] = np.interp(grid, t[ok], J[ok, c])
    JA = signal.sosfiltfilt(LP_M, JA, axis=0)
    mk = {n: G[:, i, :] for i, n in enumerate(names)}
    return grid, mk, JA, {'duplicates': dups, 'missingFrames': missing}

LP_E10 = signal.butter(4, 10.0, fs=FS_E, output='sos')
def envelopes(f):
    # Notched 6 Hz envelope (main), and two sensitivity variants: no notch (6 Hz), notched 10 Hz.
    x = f['semg_preprocessed_basic'].astype(float)
    ts = f['time_semg_s'].astype(float)
    names = [str(n).split('_')[0] for n in f['semg_channel_names']]
    assert names == CH, names
    raw = signal.sosfiltfilt(LP_E, np.abs(x), axis=0)
    x0 = x.copy()
    for b, a in NOTCH: x = signal.filtfilt(b, a, x, axis=0)
    return ts, signal.sosfiltfilt(LP_E, np.abs(x), axis=0), raw, signal.sosfiltfilt(LP_E10, np.abs(x), axis=0), x0.astype(np.float32), x.astype(np.float32)

def at(grid, y, t):
    return np.interp(t, grid, y)

def crossing(grid, h, i0, step, thr):
    # From sample i0 move by step until h <= thr; linear interpolation of the crossing time.
    i = i0
    while 0 <= i + step < len(h):
        j = i + step
        if h[j] <= thr:
            return grid[j] + (grid[i] - grid[j]) * (thr - h[j]) / (h[i] - h[j]) if h[i] != h[j] else grid[j]
        i = j
    return None

def peak_time(grid, h, i):
    if 0 < i < len(h) - 1:
        a, b, c = h[i - 1], h[i], h[i + 1]
        d = a - 2 * b + c
        if d < 0: return grid[i] + 0.5 * (a - c) / d / FS_M, b - (a - c) ** 2 / (8 * d)
    return grid[i], h[i]

def forward_axis(mk, sl):
    r = np.median(mk['R.ASIS'][sl], axis=0) - np.median(mk['L.ASIS'][sl], axis=0)
    fwd = np.array([-r[1], r[0], 0.0]); fwd /= np.linalg.norm(fwd)
    mid = (np.median(mk['R.ASIS'][sl], axis=0) + np.median(mk['L.ASIS'][sl], axis=0)) / 2
    if np.dot(mid - np.median(mk['V.Sacral'][sl], axis=0), fwd) < 0: fwd = -fwd
    return fwd

def incl(v, fwd):
    # Inclination of a line from vertical-up, forward +, in the sagittal projection (deg).
    return np.degrees(np.arctan2(v @ fwd, v[..., 2]))

def channels(mk, JA, fwd):
    asis = (mk['R.ASIS'] + mk['L.ASIS']) / 2
    out = {}
    for s in 'LR':
        heel, toe = mk[f'{s}.Heel'], mk[f'{s}.Toe']
        d = heel - toe
        horiz = np.hypot(d[:, 0], d[:, 1])
        out[f'heel{s}'] = heel[:, 2]
        out[f'toe{s}'] = toe[:, 2]
        out[f'pitch3d{s}'] = np.degrees(np.arctan2(d[:, 2], horiz))
        out[f'pitchSag{s}'] = np.degrees(np.arctan2(d[:, 2], -(d @ fwd)))
        out[f'shank{s}'] = incl(mk[f'{s}.Knee'] - mk[f'{s}.Ankle'], fwd)
        out[f'shankMk{s}'] = incl(mk[f'{s}.Shank'] - mk[f'{s}.Ankle'], fwd)
        out[f'thigh{s}'] = incl(mk[f'{s}.Thigh'] - mk[f'{s}.Knee'], fwd)
        for m_ in ('Ankle', 'Knee'):
            out[f'{m_.lower()}X{s}'] = mk[f'{s}.{m_}'] @ fwd
            out[f'{m_.lower()}Z{s}'] = mk[f'{s}.{m_}'][:, 2]
    v = asis - mk['V.Sacral']
    out['pelvis'] = -np.degrees(np.arctan2(v[:, 2], v @ fwd))
    for s in 'LR':
        # Drawn joint angles from the same lines (engine: knee = shank − thigh, hip = pelvis − thigh).
        out[f'kneeDrawn{s}'] = out[f'shank{s}'] - out[f'thigh{s}']
        out[f'hipDrawn{s}'] = out['pelvis'] - out[f'thigh{s}']
    out['asisX'] = asis @ fwd
    out['asisZ'] = asis[:, 2]
    out['kneeDsR'], out['kneeDsL'] = JA[:, 0], JA[:, 1]
    out['ankleDsR'], out['ankleDsL'] = -JA[:, 2], -JA[:, 3]  # plantarflexion negative
    return out

PAIRS = ['heel', 'toe', 'pitch3d', 'pitchSag', 'shank', 'shankMk', 'thigh', 'kneeDs', 'ankleDs', 'kneeDrawn', 'hipDrawn', 'ankleX', 'ankleZ', 'kneeX', 'kneeZ']
SINGLE = ['pelvis', 'asisX', 'asisZ']
CURVES = PAIRS + SINGLE

def onset(ts, env, s0, ho, peak, mu, sd, k, cue):
    if s0 < ts[0] + 1e-9: return None, 'window'
    thr = mu + k * sd
    m = (ts >= s0) & (ts <= peak)
    idx = np.nonzero(m)[0]
    above = env[idx] > thr
    if above[0]: return None, 'edge'
    need = int(round(SUSTAIN * FS_E))
    run = 0
    for j, a in enumerate(above):
        run = run + 1 if a else 0
        if run >= need:
            t_on = ts[idx[j - need + 1]]
            if t_on < cue: return t_on, 'beforeCue'
            return (t_on, 'ok') if t_on <= ho else (t_on, 'after')
    return None, 'missing'

# ---- heel raise -------------------------------------------------------------------------
def cues_of(key):
    r = TRIALS[key]
    if r['auditory_cue_record_available'] != 'true': return None
    return json.loads(r['auditory_cue_onsets_s_relative_to_shared_trial_origin'])

def rep_windows(grid, h2, cues):
    if cues:
        bounds = [c for c in cues] + [grid[-1] + 1]
        return [(c, bounds[i + 1] - 0.5) for i, c in enumerate(cues)]
    pk, _ = signal.find_peaks(h2, height=MIN_PEAK, distance=int(2.5 * FS_M))
    pk = sorted(sorted(pk, key=lambda i: -h2[i])[:3])
    mids = [grid[0]] + [(grid[a] + grid[b]) / 2 for a, b in zip(pk[:-1], pk[1:])] + [grid[-1]]
    return [(mids[i], mids[i + 1]) for i in range(len(pk))]

def leg_events(grid, h, i_pk, thr):
    return crossing(grid, h, i_pk, -1, thr), crossing(grid, h, i_pk, +1, thr)

reps, latencies = [], []
pending = []
for u in USERS:
    for a in ['A1', 'A2', 'A3', 'A4']:
        key = f'{u}|functional_action|heel_raise|{a}'
        f = load(TRIALS[key]['relative_path'])
        assert str(f['trial_key']) == key
        grid, mk, JA, mq = motion(f)
        ts, env, env_raw, env10, x_raw, x_notch = envelopes(f)
        cues = cues_of(key)
        z0 = {s: np.median(mk[f'{s}.Heel'][:, 2]) for s in 'LR'}
        h2 = (mk['L.Heel'][:, 2] - z0['L'] + mk['R.Heel'][:, 2] - z0['R']) / 2
        for r_i, (w0, w1) in enumerate(rep_windows(grid, h2, cues)):
            pending.append(dict(user=u, trial=a, rep=r_i + 1, key=key, cue=cues[r_i] if cues else None, w=(w0, w1),
                                grid=grid, mk=mk, JA=JA, ts=ts, env=env, env_raw=env_raw, env10=env10, mq=mq,
                                x_raw=x_raw, x_notch=x_notch))

def quiet_slice(grid, q0):
    q0 = max(q0, grid[0]); return (grid >= q0) & (grid < q0 + QUIET), q0

def evaluate(p, cue, thr=THR_MM):
    grid, mk = p['grid'], p['mk']
    sl, q0 = quiet_slice(grid, cue - QUIET)
    base = {s: np.median(mk[f'{s}.Heel'][sl, 2]) for s in 'LR'}
    h = {s: mk[f'{s}.Heel'][:, 2] - base[s] for s in 'LR'}
    hm = (h['L'] + h['R']) / 2
    w0, w1 = p['w']
    m = (grid >= max(w0, grid[0])) & (grid <= w1)
    idx = np.nonzero(m)[0]
    i_pk = idx[np.argmax(hm[idx])]
    pk_t, pk_h = peak_time(grid, hm, i_pk)
    ev = {}
    for s in 'LR':
        i_s = idx[np.argmax(h[s][idx])]
        ho, co = leg_events(grid, h[s], i_s, thr)
        ev[s] = dict(heelOff=ho, contact=co, peak=float(grid[i_s]), peakRise=float(h[s][i_s]))
    return sl, q0, base, h, hm, pk_t, pk_h, ev

# Cue → heel-off latency of subjects with cue records, for the cue-free subjects' quiet window.
for p in pending:
    if p['cue'] is None: continue
    sl, q0, base, h, hm, pk_t, pk_h, ev = evaluate(p, p['cue'])
    if pk_h >= MIN_PEAK and all(ev[s]['heelOff'] is not None for s in 'LR'):
        latencies.append(np.mean([ev[s]['heelOff'] for s in 'LR']) - p['cue'])
LAT = float(np.median(latencies))

def rep_record(p, thr=THR_MM, full=True):
    grid, mk = p['grid'], p['mk']
    cue = p['cue']
    pseudo = cue is None
    if pseudo:
        # Preliminary heel-off against the first 0.5 s of the repetition window, then the quiet window from LAT.
        _, _, _, _, hm, pk_t, pk_h, ev = evaluate(p, p['w'][0] + QUIET)
        hos = [ev[s]['heelOff'] for s in 'LR' if ev[s]['heelOff'] is not None]
        cue = (np.mean(hos) if hos else pk_t - 0.4) - LAT
    sl, q0, base, h, hm, pk_t, pk_h, ev = evaluate(p, cue, thr)
    no_quiet = bool(q0 > cue - QUIET + 1e-9)  # Wq would start before the trial
    rec = dict(user=p['user'], trial=p['trial'], rep=p['rep'], cue=None if pseudo else cue, pseudoCue=cue if pseudo else None,
               quietStart=float(q0), quietShifted=no_quiet, peak=pk_t, peakRise=float(pk_h),
               legs={s: ev[s] for s in 'LR'})
    ok = pk_h >= MIN_PEAK and all(ev[s]['heelOff'] is not None and ev[s]['contact'] is not None for s in 'LR') and not no_quiet
    rec['valid'] = bool(ok)
    if not ok:
        rec['reason'] = 'no quiet window' if no_quiet else 'peak<20mm' if pk_h < MIN_PEAK else 'no crossing'
        if no_quiet and full:
            # Record why: the window that would have been used is not quiet (EMG and pelvis vs the next repetition).
            ts = p['ts']; qm = (ts >= q0) & (ts < q0 + QUIET)
            rec['shiftedWindow'] = dict(start=float(q0), end=float(q0 + QUIET),
                                        taMeanSd=[float(p['env'][qm, CH.index('TA')].mean()), float(p['env'][qm, CH.index('TA')].std())],
                                        gaMeanSd=[float(p['env'][qm, CH.index('GA')].mean()), float(p['env'][qm, CH.index('GA')].std())],
                                        heelRangeMm=float(max(np.ptp(h[s][sl]) for s in 'LR')))
        return rec
    ho = float(np.mean([ev[s]['heelOff'] for s in 'LR'])); co = float(np.mean([ev[s]['contact'] for s in 'LR']))
    rec.update(heelOff=ho, contact=co, rise=pk_t - ho, lowering=co - pk_t, cueToHeelOff=None if pseudo else ho - cue,
               above90=float(((hm >= 0.9 * pk_h) & (grid >= ho) & (grid <= co)).sum() / FS_M))
    if not full: return rec
    # Quiet-window check: heel range inside Wq.
    rec['quietHeelRange'] = float(max(np.ptp(h[s][sl]) for s in 'LR'))
    fwd = forward_axis(mk, sl)
    rec['forwardCheck'] = bool(all(np.dot(np.median(mk[f'{s}.Toe'][sl] - mk[f'{s}.Heel'][sl], axis=0), fwd) > 0 for s in 'LR'))
    ch = channels(mk, p['JA'], fwd)
    ref = {k: np.median(v[sl]) for k, v in ch.items()}
    rel = {k: v - ref[k] for k, v in ch.items()}
    # EMG onsets
    ts, env = p['ts'], p['env']
    qm = (ts >= q0) & (ts < q0 + QUIET)
    s0 = min(cue, ho - SEARCH_LEAD)
    on, on_raw = {}, {}
    for c in ['TA', 'GA']:
        for E, dst in ((env, on), (p['env_raw'], on_raw)):
            e = E[:, CH.index(c)]
            mu, sd = e[qm].mean(), e[qm].std()
            dst[c] = {}
            for k in K_SD:
                t_on, status = onset(ts, e, s0, ho, pk_t, mu, sd, k, cue)
                dst[c][str(k)] = dict(t=t_on, status=status, lead=None if t_on is None else ho - t_on)
            dst[c]['baseline'] = [float(mu), float(sd)]
    rec['onset'] = on
    rec['onsetNoNotch'] = on_raw
    rec['searchStart'] = s0
    # TA–GA envelope correlation from heel-off − 1.2 s to contact (crosstalk check)
    cm = (ts >= ho - SEARCH_LEAD) & (ts <= co)
    rec['taGaCorr'] = float(np.corrcoef(env[cm, CH.index('TA')], env[cm, CH.index('GA')])[0, 1])
    # Mains share in Wq (periodogram, Hann and rectangular windows), before and after the notch
    ms = {}
    for wname, win in (('hann', 'hann'), ('rect', 'boxcar')):
        for lab, X in (('raw', p['x_raw']), ('notch', p['x_notch'])):
            fr, P = signal.periodogram(X[qm].astype(float), fs=FS_E, window=win, detrend='constant', axis=0)
            band = np.zeros_like(fr, bool)
            for kk in range(1, 10): band |= np.abs(fr - 50 * kk) <= 2
            inb = (fr >= 20) & (fr <= 450)
            ms[f'{wname}_{lab}'] = {c: float(P[band, i].sum() / P[inb, i].sum()) for i, c in enumerate(CH)}
    rec['mains'] = ms
    # Normalised segments
    t_on = on['TA'][str(K_MAIN)]['t'] if on['TA'][str(K_MAIN)]['status'] == 'ok' else None
    segs = {}
    if t_on is not None:
        segs['Q'] = np.linspace(t_on - QUIET, t_on, N_Q)
        segs['A'] = np.linspace(t_on, ho, N_SEG)
    segs['R'] = np.linspace(ho, pk_t, N_SEG)
    segs['L'] = np.linspace(pk_t, co, N_SEG)
    grid_ok = all(s[0] >= grid[0] and s[-1] <= grid[-1] for s in segs.values())
    curves = {}
    for name, tt in segs.items():
        curves[name] = {}
        for k in CURVES:
            if k in PAIRS:
                curves[name][k] = (at(grid, rel[k + 'L'], tt) + at(grid, rel[k + 'R'], tt)) / 2
                curves[name][k + 'L'] = at(grid, rel[k + 'L'], tt)
                curves[name][k + 'R'] = at(grid, rel[k + 'R'], tt)
            else:
                curves[name][k] = at(grid, rel[k], tt)
        curves[name]['emg'] = {c: np.interp(tt, ts, env[:, i]) for i, c in enumerate(CH)}
    rec['_curves'] = curves
    rec['gridOk'] = grid_ok
    # EMG phase means (µV), notched and not notched, real-time means
    def mean_env(e, a, b):
        m = (ts >= a) & (ts <= b); return float(e[m].mean()) if m.any() else float('nan')
    pm = {}
    for label, E in [('notch', env), ('raw', p['env_raw']), ('env10', p['env10'])]:
        pm[label] = {}
        for i, c in enumerate(CH):
            row = {'R': mean_env(E[:, i], ho, pk_t), 'L': mean_env(E[:, i], pk_t, co),
                   'Wq': mean_env(E[:, i], q0, q0 + QUIET)}
            if t_on is not None:
                row['Q'] = mean_env(E[:, i], t_on - QUIET, t_on); row['A'] = mean_env(E[:, i], t_on, ho)
            pm[label][c] = row
    rec['emgMeans'] = pm
    # GA before heel-off relative to Wq (0.1 s bins, 1.2–0.5 s before heel-off)
    ga = env[:, CH.index('GA')]; mu = ga[qm].mean()
    rec['gaBins'] = [mean_env(ga, ho - b - 0.1, ho - b) / mu for b in np.round(np.arange(0.5, 1.2, 0.1), 2)]
    # Circle fit of the right heel marker (sagittal plane) from heel-off to the peak
    seg = (grid >= ho) & (grid <= pk_t)
    P = np.stack([mk['R.Heel'][seg] @ fwd, mk['R.Heel'][seg, 2]], 1)
    A_ = np.c_[2 * P, np.ones(len(P))]; b_ = (P ** 2).sum(1)
    cx, cz, c0 = np.linalg.lstsq(A_, b_, rcond=None)[0]
    rad = float(np.sqrt(c0 + cx ** 2 + cz ** 2))
    ang = np.degrees(np.unwrap(np.arctan2(P[:, 1] - cz, P[:, 0] - cx)))  # unwrapped across ±180°
    toe = np.array([np.median(mk['R.Toe'][sl] @ fwd), np.median(mk['R.Toe'][sl, 2])])
    rec['pitchMax'] = {f'{k}{s}': float(rel[k + s][(grid >= ho) & (grid <= co)].max()) for k in ('pitch3d', 'pitchSag') for s in 'LR'}
    rec['circle'] = dict(radius=rad, sweep=float(abs(ang[-1] - ang[0])), centreBehindToe=float(toe[0] - cx), centreBelowToe=float(toe[1] - cz))
    return rec

all_reps = [rep_record(p) for p in pending]
valid = [r for r in all_reps if r['valid']]

# ---- walking ----------------------------------------------------------------------------
def walk_trial(rel):
    f = load(rel)
    grid, mk, _, mq = motion(f)
    ts, env, _, env10, _, _ = envelopes(f)
    sl = slice(None)
    fwd = forward_axis(mk, sl)
    x = (mk['L.Heel'] - mk['V.Sacral']) @ fwd
    pk, _ = signal.find_peaks(x, distance=int(0.6 * FS_M), prominence=80)
    hs = grid[pk]
    d = np.diff(hs)
    med = np.median(d)
    cycles = []
    for a, b in zip(hs[:-1], hs[1:]):
        if not (0.75 * med <= b - a <= 1.25 * med): continue
        if a < ts[0] or b > ts[-1]: continue
        tt = np.linspace(a, b, 101)
        cycles.append(np.stack([np.interp(tt, ts, E[:, i]) for E in (env, env10) for i in range(4)], 1))
    # left heel lift (rises 15 mm above its stance minimum) as % of each kept cycle
    hz = mk['L.Heel'][:, 2]
    lifts = []
    for a, b in zip(hs[:-1], hs[1:]):
        if not (0.75 * med <= b - a <= 1.25 * med): continue
        m = (grid >= a) & (grid <= b); g, z = grid[m], hz[m]
        i0 = np.argmin(z[: max(2, len(z) // 2)])
        up = np.nonzero(z[i0:] > z[i0] + 15)[0]
        if len(up): lifts.append(100 * (g[i0 + up[0]] - a) / (b - a))
    return cycles, float(med), lifts, len(hs)

walk = {}
for u in USERS:
    walk[u] = {}
    for spd, reps_ in [('4', ['A1', 'A2', 'A3', 'A4']), ('3', ['A1']), ('5', ['A1'])]:
        for a in reps_:
            key = f'{u}|treadmill_walking|treadmill_walking_{spd}_kmh|{a}'
            cyc, med, lifts, nstrikes = walk_trial(TRIALS[key]['relative_path'])
            walk[u][f'{spd}/{a}'] = dict(cycles=cyc, median=med, lifts=lifts, strikes=nstrikes)

def ref_of(u, keys, variant=0, cycle_peaks=False):
    cyc = [c[:, 4 * variant: 4 * variant + 4] for k in keys for c in walk[u][k]['cycles']]
    mean = np.mean(cyc, axis=0)
    peak = np.mean([c.max(axis=0) for c in cyc], axis=0) if cycle_peaks else mean.max(axis=0)
    return peak, mean.argmax(axis=0), len(cyc), mean
REFSETS = {'4kmh_A1-A4': ['4/A1', '4/A2', '4/A3', '4/A4'], '4kmh_A1': ['4/A1'], '3kmh_A1': ['3/A1'], '5kmh_A1': ['5/A1']}
refs = {name: {u: ref_of(u, keys) for u in USERS} for name, keys in REFSETS.items()}
refs['4kmh_A1-A4_env10'] = {u: ref_of(u, REFSETS['4kmh_A1-A4'], 1) for u in USERS}
refs['4kmh_A1-A4_cyclePeaks'] = {u: ref_of(u, REFSETS['4kmh_A1-A4'], cycle_peaks=True) for u in USERS}
# Crosstalk check: TA peak position and TA–GA correlation of each subject's mean 4 km/h cycle
TA_I, GA_I = CH.index('TA'), CH.index('GA')
walk_corr = {u: float(np.corrcoef(refs['4kmh_A1-A4'][u][3][:, TA_I], refs['4kmh_A1-A4'][u][3][:, GA_I])[0, 1]) for u in USERS}
STANCE_TA = sorted(u for u in USERS if CROSSTALK_BIN[0] <= int(refs['4kmh_A1-A4'][u][1][TA_I]) <= CROSSTALK_BIN[1])

# ---- aggregation ------------------------------------------------------------------------
def mstat(v):
    v = np.asarray([x for x in v if x is not None and np.isfinite(x)], float)
    if not len(v): return None
    q = np.percentile(v, [25, 50, 75])
    return dict(mean=round(float(v.mean()), 4), sd=round(float(v.std(ddof=1)), 4) if len(v) > 1 else 0.0, median=round(float(q[1]), 4),
                iqr=[round(float(q[0]), 4), round(float(q[2]), 4)], min=round(float(v.min()), 4), max=round(float(v.max()), 4), n=int(len(v)))

def by_subject(rs, fn):
    out = {}
    for r in rs:
        v = fn(r)
        if v is None or not np.isfinite(v): continue
        out.setdefault(r['user'], []).append(v)
    return {u: float(np.mean(v)) for u, v in out.items()}

def group(rs, fn):
    return mstat(list(by_subject(rs, fn).values()))

ok_on = lambda r, c='TA', k=K_MAIN: r['onset'][c][str(k)]['status'] == 'ok'
durations = {
    'cueToHeelOff': group(valid, lambda r: r['cueToHeelOff']),
    'anticipatory': group([r for r in valid if ok_on(r)], lambda r: r['onset']['TA'][str(K_MAIN)]['lead']),
    'rise': group(valid, lambda r: r['rise']),
    'lowering': group(valid, lambda r: r['lowering']),
    'above90': group(valid, lambda r: r['above90']),
}
# Threshold sensitivity (events only)
sens = {}
for thr in THR_SENS:
    rr = [rep_record(p, thr, full=False) for p in pending]
    vv = [r for r in rr if r['valid']]
    sens[str(thr)] = dict(valid=len(vv), rise=group(vv, lambda r: r['rise']), lowering=group(vv, lambda r: r['lowering']),
                          cueToHeelOff=group(vv, lambda r: r['cueToHeelOff']))

# Onset statistics ('ok' only; 'withBeforeCue' also keeps the onsets before the cue, as before this rule)
def onset_stats(key, rs):
    out = {}
    for c in ['TA', 'GA']:
        out[c] = {}
        for k in K_SD:
            st = {}
            for r in rs:
                s = r[key][c][str(k)]['status']
                st.setdefault(s, []).append(f"{r['user']}/{r['trial']}#{r['rep']}")
            okr = [r for r in rs if r[key][c][str(k)]['status'] == 'ok']
            wbc = [r for r in rs if r[key][c][str(k)]['status'] in ('ok', 'beforeCue')]
            out[c][str(k)] = dict(counts={s: len(v) for s, v in st.items()}, excluded={s: v for s, v in st.items() if s != 'ok'},
                                  lead=group(okr, lambda r: r[key][c][str(k)]['lead']),
                                  leadPooled=mstat([r[key][c][str(k)]['lead'] for r in okr]),
                                  leadWithBeforeCue=group(wbc, lambda r: r[key][c][str(k)]['lead']),
                                  cueToOnset=group([r for r in okr if r['cue'] is not None], lambda r: r[key][c][str(k)]['t'] - r['cue']),
                                  subjects=len({r['user'] for r in okr}))
    return out
def order_stats(key, rs, statuses=('ok',)):
    out = {}
    for k in K_SD:
        both = [r for r in rs if r[key]['TA'][str(k)]['status'] in statuses and r[key]['GA'][str(k)]['status'] in statuses]
        first = [r[key]['TA'][str(k)]['t'] < r[key]['GA'][str(k)]['t'] for r in both]
        out[str(k)] = dict(n=len(both), taFirst=int(sum(first)), share=round(float(np.mean(first)), 4) if both else None)
    return out
onsets = onset_stats('onset', valid)
order = order_stats('onset', valid)
orderWithBeforeCue = order_stats('onset', valid, ('ok', 'beforeCue'))
onsetsNoNotch = onset_stats('onsetNoNotch', valid)
orderNoNotch = order_stats('onsetNoNotch', valid)

# Group curves: per subject mean over repetitions, then mean and SD over subjects
def group_curves(seg, rs):
    per = {}
    for r in rs:
        if seg not in r['_curves']: continue
        per.setdefault(r['user'], []).append(r['_curves'][seg])
    out = {'subjects': len(per), 'repetitions': sum(len(v) for v in per.values())}
    keys = list(next(iter(per.values()))[0].keys())
    for k in keys:
        if k == 'emg': continue
        S = np.array([np.mean([c[k] for c in v], axis=0) for v in per.values()])
        out[k] = dict(mean=np.round(S.mean(0), 4).tolist(), sd=np.round(S.std(0, ddof=1), 4).tolist())
    # EMG curves normalised to each subject's walking reference
    ref = refs['4kmh_A1-A4']
    for c in ['TA', 'GA']:
        i = CH.index(c)
        S = np.array([np.mean([cc['emg'][c] for cc in v], axis=0) / ref[u][0][i] * 100 for u, v in per.items()])
        out['emg' + c] = dict(mean=np.round(S.mean(0), 3).tolist(), sd=np.round(S.std(0, ddof=1), 3).tolist())
    return out
curves = {seg: group_curves(seg, valid) for seg in ['Q', 'A', 'R', 'L']}

# Values at events and extremes (subject means of repetition values)
def at_event(k, seg, idx):
    return group([r for r in valid if seg in r['_curves']], lambda r: float(r['_curves'][seg][k][idx]))
events_vals = {}
for k in [c for c in curves['R'].keys() if c not in ('subjects', 'repetitions') and not c.startswith('emg')]:
    events_vals[k] = dict(onset=at_event(k, 'A', 0), heelOff=at_event(k, 'R', 0), peak=at_event(k, 'R', -1), contact=at_event(k, 'L', -1))
peaks = {
    'heelRiseR': group(valid, lambda r: r['legs']['R']['peakRise']), 'heelRiseL': group(valid, lambda r: r['legs']['L']['peakRise']),
    'heelRiseMean': group(valid, lambda r: r['peakRise']),
    'asisForwardMax': group(valid, lambda r: float(max(c['asisX'].max() for c in r['_curves'].values()))),
    'asisUpMax': group(valid, lambda r: float(max(c['asisZ'].max() for c in r['_curves'].values()))),
}
for s in 'LR':
    for k in ['pitch3d', 'pitchSag', 'ankleDs', 'kneeDs', 'shank', 'thigh', 'toe']:
        peaks[f'{k}{s}AtPeak'] = group(valid, lambda r, k=k, s=s: float(r['_curves']['R'][k + s][-1]))
pitch_max = {k: group(valid, lambda r, k=k: r['pitchMax'][k]) for k in ['pitch3dR', 'pitch3dL', 'pitchSagR', 'pitchSagL']}
circle = {k: group(valid, lambda r, k=k: r['circle'][k]) for k in ['radius', 'sweep', 'centreBehindToe', 'centreBelowToe']}
circle_median = {k: mstat([np.median([r['circle'][k] for r in valid if r['user'] == u]) for u in USERS]) for k in ['radius', 'sweep', 'centreBehindToe', 'centreBelowToe']}

# EMG phase means as % of the walking reference
def emg_table(refname, label='notch', drop=()):
    ref = refs[refname]
    out = {}
    for c in CH:
        i = CH.index(c)
        out[c] = {}
        for ph in ['Q', 'A', 'R', 'L', 'Wq']:
            rs = [r for r in valid if ph in r['emgMeans'][label][c] and r['user'] not in drop]
            per = by_subject(rs, lambda r: r['emgMeans'][label][c][ph] / ref[r['user']][0][i] * 100)
            st = mstat(list(per.values()))
            st['over30'] = int(sum(v >= 30 for v in per.values()))
            out[c][ph] = st
    return out
emg = {name: emg_table(name) for name in REFSETS}
emg['4kmh_A1-A4_noNotch'] = emg_table('4kmh_A1-A4', 'raw')  # reference stays the notched one
emg['4kmh_A1-A4_env10Hz'] = emg_table('4kmh_A1-A4_env10', 'env10')
emg['4kmh_A1-A4_cyclePeaks'] = emg_table('4kmh_A1-A4_cyclePeaks')
emg['4kmh_A1-A4_withoutStanceTA'] = emg_table('4kmh_A1-A4', drop=STANCE_TA)
# Crosstalk record per subject
hr_corr = by_subject(valid, lambda r: r['taGaCorr'])
ta_pct = {ph: by_subject([r for r in valid if ph in r['emgMeans']['notch']['TA']], lambda r, ph=ph: r['emgMeans']['notch']['TA'][ph] / refs['4kmh_A1-A4'][r['user']][0][TA_I] * 100) for ph in ['A', 'R', 'L']}
crosstalk = dict(rule=f'walking TA mean-cycle maximum at {CROSSTALK_BIN[0]}–{CROSSTALK_BIN[1]}% of the cycle', subjects=STANCE_TA,
                 perSubject={u: dict(taPeakAt=int(refs['4kmh_A1-A4'][u][1][TA_I]), gaPeakAt=int(refs['4kmh_A1-A4'][u][1][GA_I]),
                                     walkTaGaCorr=round(walk_corr[u], 3), heelRaiseTaGaCorr=round(hr_corr[u], 3),
                                     taA=round(ta_pct['A'][u], 1), taR=round(ta_pct['R'][u], 1), taL=round(ta_pct['L'][u], 1)) for u in USERS},
                 walkCorr=dict(stance=mstat([walk_corr[u] for u in STANCE_TA]), others=mstat([walk_corr[u] for u in USERS if u not in STANCE_TA])),
                 heelRaiseCorr=dict(stance=mstat([hr_corr[u] for u in STANCE_TA]), others=mstat([hr_corr[u] for u in USERS if u not in STANCE_TA])),
                 anticipatory=group([r for r in valid if ok_on(r) and r['user'] not in STANCE_TA], lambda r: r['onset']['TA'][str(K_MAIN)]['lead']),
                 order=order_stats('onset', [r for r in valid if r['user'] not in STANCE_TA]))
def subject_median_table(refname, label='notch'):
    ref = refs[refname]; out = {}
    for c in CH:
        i = CH.index(c); out[c] = {}
        for ph in ['Q', 'A', 'R', 'L']:
            rs = [r for r in valid if ph in r['emgMeans'][label][c]]
            out[c][ph] = round(float(np.median(list(by_subject(rs, lambda r: r['emgMeans'][label][c][ph] / ref[r['user']][0][i] * 100).values()))), 2)
    return out
# Walking references and the clock check (peak position in the mean cycle, % from left heel strike)
walk_ref = {}
for name in REFSETS:
    walk_ref[name] = {u: dict(peak_uV=[round(float(x), 3) for x in refs[name][u][0]], peakAt=[int(x) for x in refs[name][u][1]], cycles=refs[name][u][2]) for u in USERS}
clock = {}
for c in CH:
    i = CH.index(c)
    clock[c] = mstat([refs['4kmh_A1-A4'][u][1][i] for u in USERS])
for c in ['TA', 'GA']:
    pos = [int(refs['4kmh_A1-A4'][u][1][CH.index(c)]) for u in USERS]
    clock[c + 'Bins'] = {'0-15': sum(p <= 15 for p in pos), '16-54': sum(15 < p < 55 for p in pos), '55-85': sum(55 <= p <= 85 for p in pos), '86-100': sum(p > 85 for p in pos)}
clock['heelLift'] = mstat([np.median([x for k in REFSETS['4kmh_A1-A4'] for x in walk[u][k]['lifts']]) for u in USERS])
clock['cyclesPerSubject'] = mstat([refs['4kmh_A1-A4'][u][2] for u in USERS])
clock['cycleDuration'] = mstat([np.median([walk[u][k]['median'] for k in REFSETS['4kmh_A1-A4']]) for u in USERS])
mean_cycle = {c: np.round(np.mean([refs['4kmh_A1-A4'][u][3][:, CH.index(c)] / refs['4kmh_A1-A4'][u][0][CH.index(c)] * 100 for u in USERS], axis=0), 2).tolist() for c in CH}
# GA before heel-off (soleus caveat: no decrease seen in the gastrocnemius)
ga_bins = []
for j, b in enumerate(np.round(np.arange(0.5, 1.2, 0.1), 2)):
    per = by_subject(valid, lambda r: r['gaBins'][j])
    ga_bins.append(dict(window=f'{b + 0.1:.1f}–{b:.1f} s before heel-off', groupMedian=round(float(np.median(list(per.values()))), 3),
                        under09=int(sum(v < 0.9 for v in per.values()))))
# Mains share in the quiet window, before and after the notch (one trial per subject, first repetition)
mains = {f'{c}{w}': [] for c in CH for w in ('', 'AfterNotch')}
for p in [p for p in pending if p['rep'] == 1 and p['trial'] == 'A1']:
    r = next(x for x in all_reps if x['user'] == p['user'] and x['trial'] == 'A1' and x['rep'] == 1)
    q0 = r['quietStart']
    f = np.load(os.path.join(ROOT, TRIALS[p['key']]['relative_path']), allow_pickle=False)
    x = f['semg_preprocessed_basic'].astype(float); ts = f['time_semg_s']
    m = (ts >= q0 - 1.0) & (ts < q0 + QUIET)
    xn = x.copy()
    for b, a in NOTCH: xn = signal.filtfilt(b, a, xn, axis=0)
    for i, c in enumerate(CH):
        for w, X in (('', x), ('AfterNotch', xn)):
            fr, P = signal.welch(X[m, i], fs=FS_E, nperseg=512)
            band = np.zeros_like(fr, bool)
            for k in range(1, 10): band |= np.abs(fr - 50 * k) <= 2
            inb = (fr >= 20) & (fr <= 450)
            mains[c + w].append(float(P[band].sum() / P[inb].sum()))
mains_legacy = {c: mstat(v) for c, v in mains.items()}
# Main definition: every valid repetition's Wq, subject means, median over subjects
mains = {}
for variant in ('hann_raw', 'hann_notch', 'rect_raw', 'rect_notch'):
    mains[variant] = {c: mstat(list(by_subject(valid, lambda r, c=c, v=variant: r['mains'][v][c]).values())) for c in CH}
mains['welchA1rep1_1.5s'] = mains_legacy

# SHA-256 of every file read, checked against the fetch manifests where present
manifest = {}
for name in os.listdir(ROOT):
    if name.startswith('manifest-') and name.endswith('.csv'):
        for row in csv.DictReader(open(os.path.join(ROOT, name), newline='')): manifest[row['relative_path']] = row['lfs_oid']
files = [dict(path=k, sha256=v, lfsMatch=(manifest.get(k) == v) if k in manifest else None) for k, v in sorted(read_files.items())]
for f_ in files:
    if f_['path'] == 'metadata/trials.csv':
        f_['gitBlob'] = git_blob(trials_csv); f_['gitBlobMatch'] = f_['gitBlob'] == TRIALS_CSV_BLOB

def finite(o):
    # JSON has no NaN: non-finite numbers become null.
    if isinstance(o, dict): return {k: finite(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [finite(v) for v in o]
    if isinstance(o, (float, np.floating)): return float(o) if np.isfinite(o) else None
    if isinstance(o, np.integer): return int(o)
    if isinstance(o, np.bool_): return bool(o)
    return o

def clean(r):
    return finite({k: v for k, v in r.items() if not k.startswith('_')})

out = dict(
    source=dict(dataset='SAME-Limb v2.0.3', repo='Tdongxu/A_Synchronized_Lower_Limb_AMG_sEMG_and_Mocap', revision='0b674b5feb98a795d804df1e0bb76f13d713cd6a',
                doi='10.57967/hf/9950', licence='CC BY 4.0 (data); code Apache-2.0', article='arXiv:2608.11958v1 (preprint)'),
    definitions=dict(lowpassMotionHz=6, lowpassEnvelopeHz=6, notchHz=[50 * k for k in range(1, 10)], notchQ=30, heelThresholdMm=THR_MM,
                     thresholdSensitivityMm=THR_SENS, minPeakMm=MIN_PEAK, quietWindowS=QUIET, searchLeadS=SEARCH_LEAD, onsetSD=K_MAIN,
                     onsetSensitivitySD=K_SD, sustainS=SUSTAIN, cueFreeLatencyS=round(LAT, 4), segmentPoints=N_SEG, quietPoints=N_Q,
                     filters='Low-pass: scipy butter(4, fc, output="sos") applied with sosfiltfilt (4th-order Butterworth, forward and backward = zero phase, magnitude squared, -6 dB at fc). Notch: iirnotch(f, Q=30) with filtfilt. Motion and dataset joint angles: linear resampling to a uniform 90 Hz grid before filtering; EMG stays on its 1000 Hz clock.',
                     repetitionWindows='With cue records: cue i to cue i+1 - 0.5 s (last: trial end). Without: the three highest two-leg mean heel peaks (>= 20 mm, >= 2.5 s apart, whole-trial median baseline), split at midpoints.',
                     quietWindow='Wq = the 0.5 s before the cue. Without cue records: pseudo cue = preliminary heel-off (baseline: the first 0.5 s of the repetition window) - cueFreeLatencyS (median cue-to-heel-off of the repetitions with cue records). A repetition whose Wq would start before the trial is dropped from every value (reason "no quiet window").',
                     heelEvents='Per leg: heel height minus its Wq median; heel-off = last upward crossing of heelThresholdMm before that leg\'s highest sample in the repetition window, contact = first downward crossing after it (linear interpolation). Repetition heel-off/contact = mean of the two legs\' crossing times; peak = maximum of the two-leg mean rise with three-point parabolic refinement. Valid: two-leg mean peak >= minPeakMm and all four crossings.',
                     onset='Envelope = notch, rectification, low-pass. Search from s0 = min(cue, heel-off - searchLeadS) to the peak; onset = first sample of the first run of round(sustainS * 1000) consecutive samples above mean + k SD of Wq. Excluded and counted: edge (above at s0), beforeCue (onset before the cue or pseudo cue), after (onset after heel-off), missing (no run), window (s0 before the EMG record).',
                     normalisation='Q = 0.5 s before the TA onset (51 points); A = onset to heel-off, R = heel-off to peak, L = peak to contact (101 points each), linear interpolation; per subject mean over repetitions, then mean and SD over subjects; legs averaged. Repetitions without a valid TA onset enter R and L only.',
                     walking='Left heel strike = peaks of the forward L.Heel - V.Sacral distance (scipy find_peaks, distance 0.6 s, prominence 80 mm); cycles 0.75-1.25 x the trial median; 101 points per cycle; reference = maximum of the subject\'s mean cycle (A1-A4 at 4 km/h).',
                     phaseMeans='Real-time envelope mean over each phase, % of the subject\'s reference; mean over repetitions, then mean (and median) over subjects.',
                     mainsShare='Each valid repetition\'s Wq: scipy periodogram (Hann window, constant detrend); share = power within +-2 Hz of 50..450 Hz / power in 20-450 Hz; subject means, median over subjects. Variants: rectangular window; earlier A1 repetition 1, 1.5 s Welch (nperseg 512).',
                     crosstalk=f'Subjects whose walking TA mean-cycle maximum lies at {CROSSTALK_BIN[0]}-{CROSSTALK_BIN[1]}% of the cycle; tables also given without them.',
                     circle='Algebraic least-squares circle through the right heel marker (sagittal) from heel-off to peak; sweep = unwrapped angle change.',
                     files='SHA-256 of each file read; npz vs the fetch manifests (LFS SHA-256); metadata/trials.csv vs its git blob id in the v2.0.3 tree.'),
    counts=dict(subjects=len(USERS), repetitions=len(all_reps), valid=len(valid), invalid=[clean(r) for r in all_reps if not r['valid']],
                cueFreeSubjects=sorted({r['user'] for r in all_reps if r['cue'] is None}),
                quietShifted=[f"{r['user']}/{r['trial']}#{r['rep']}" for r in all_reps if r.get('quietShifted')],
                quietHeelRangeMax=round(max(r['quietHeelRange'] for r in valid), 3),
                quietHeelRangeOver3mm=[f"{r['user']}/{r['trial']}#{r['rep']}" for r in valid if r['quietHeelRange'] > 3],
                forwardCheckFailed=[f"{r['user']}/{r['trial']}#{r['rep']}" for r in valid if not r['forwardCheck']],
                gridFailed=[f"{r['user']}/{r['trial']}#{r['rep']}" for r in valid if not r['gridOk']],
                motionDuplicates=sum(p['mq']['duplicates'] for p in pending if p['rep'] == 1),
                motionMissingFrames=sum(p['mq']['missingFrames'] for p in pending if p['rep'] == 1)),
    durations=durations, thresholdSensitivity=sens, onsets=onsets, onsetOrder=order, onsetOrderWithBeforeCue=orderWithBeforeCue,
    onsetsNoNotch=onsetsNoNotch, onsetOrderNoNotch=orderNoNotch,
    curves=curves, events=events_vals, peaks=peaks, pitchMax=pitch_max, circle=circle, emgSubjectMedians=subject_median_table('4kmh_A1-A4'), circleSubjectMedians=circle_median,
    emg=emg, walkReference=walk_ref, clock=clock, crosstalk=crosstalk, walkMeanCycle=mean_cycle, gaBeforeHeelOff=ga_bins, mainsShareQuiet=mains,
    repetitions=[clean(r) for r in all_reps], files=files,
)
json.dump(finite(out), open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'), allow_nan=False)
lfs_ok = all(f['lfsMatch'] for f in files if f['lfsMatch'] is not None)
blob_ok = all(f.get('gitBlobMatch', True) for f in files)
print('ok', len(all_reps), 'repetitions,', len(valid), 'valid; files', len(files), f"({sum(f['lfsMatch'] is True for f in files)} LFS SHA-256 match, trials.csv git blob {'match' if blob_ok else 'MISMATCH'})" if lfs_ok else 'LFS MISMATCH')
