# Cuts the launch trailer (16:9 = L, 9:16 = P) from the frame folders shoot.mjs and town.mjs record,
# the caption cards overlays.mjs draws, and the Rave Mode track, cutting on its 0.4 s beats.
# python3 scripts/trailer/cut.py L|P   (dirs via TRAILER=<work dir>, MUSIC=<mp3 of the Rave Mode track>)
#
# Shape: a 2-bar cold open on the drop, the logo, the town and cars over the build, the start lights
# counting down the last bar so green lands on the drop, then 16 s of racing on the beat and the end card.
import os, subprocess, sys

O = sys.argv[1]
W, H = (1920, 1080) if O == 'L' else (1080, 1920)
WORK = os.environ.get('TRAILER', '/tmp/trailer')
S, T, OV = f'{WORK}/shots', f'{WORK}/cut-{O}', f'{WORK}/ov'
os.makedirs(T, exist_ok=True)
FPS = 30
BEAT = 0.4  # 150 bpm
MUSIC = os.environ.get('MUSIC', '/mnt/project-files/ambience/techno/rave-mode-buildup-and-drop.mp3')
DROP = 58.0  # the drop in the track; the build's last 8 bars start at 45.2

# (shot, offset into the shot s, length s, options). punch: a small zoom kick on every beat;
# slow: played at half speed; zoom: cropped in.
FRONT = 1.7 if O == 'L' else 1.5
segs = [
    # Cold open, on the drop.
    ('duel-main', 1.0, 0.8, {'punch': 1}), ('track-vegas', 0.4, 0.8, {'punch': 1}),
    ('flyover-giza', 0.4, 0.8, {'punch': 1}), ('pass', 1.6, 0.8, {'punch': 1}),
    # The build: logo, town, cars.
    ('t1-reveal', 0.6, 3.2, {}), ('t2-street', 0.2, 1.6, {}), ('t3-night', 0.6, 1.6, {}),
    ('car-tomahawk', 0.2, 0.8, {'zoom': 1.15}), ('car-zenith', 0.2, 0.8, {'zoom': FRONT}),
    ('car-hyper', 0.2, 0.8, {'zoom': 1.15}), ('car-stomper', 0.2, 0.8, {'zoom': FRONT}),
    # Red, red, amber on the beat; green on the drop.
    ('launch', 0.0, 4.0, {'zoom': 1.45 if O == 'L' else 1.15}),
    ('duel-vegas', 0.6, 0.8, {'punch': 1}), ('track-main', 0.6, 0.8, {'punch': 1}),
    ('gp', 1.0, 0.8, {'punch': 1}), ('pass', 1.45, 1.6, {'slow': 1}),
    ('drone', 1.0, 0.8, {'punch': 1}), ('flyover-sydney', 0.6, 0.8, {'punch': 1}),
    ('duel-rio', 0.6, 0.8, {'punch': 1}), ('low', 2.0, 0.8, {'punch': 1}),
    *[(f'w-{v}', 0.4, 0.4, {}) for v in ['giza', 'moscow', 'rio', 'rome', 'vegas', 'london', 'sydney', 'shanghai']],
    ('duel-moscow', 0.6, 0.8, {'punch': 1}), ('track-giza', 0.6, 0.8, {'punch': 1}),
    ('track-vegas', 1.2, 0.8, {'punch': 1}), ('duel-main', 1.6, 0.8, {'punch': 1}),
    ('flyover-sydney', 1.4, 0.8, {'punch': 1}), ('gp', 2.2, 0.8, {'punch': 1}),
    ('t4-end', 0.0, 4.4, {}),
]
starts, t = [], 0.0
for s in segs:
    starts.append(t)
    t += s[2]
total = round(t, 2)
GRADE = 'eq=saturation=1.22:contrast=1.06:brightness=0.01'

parts = []
for i, (name, off, ln, opt) in enumerate(segs):
    d = f'{S}/{O}-{name}'
    out = f'{T}/{i:02d}.mp4'
    parts.append(out)
    frames = len([f for f in os.listdir(d) if f.endswith('.png')])
    # Town shots may be drawn at 15 fps (the full game is slow to draw); those are blended up to 30.
    src = 15 if name.startswith('t') and frames < 90 else FPS
    if name == 't4-end':
        src = 13.5  # 4 s of drift stretched under the end card
    up = ''
    if opt.get('slow'):
        src, up = FPS / 2, 'minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1,'
    elif src != FPS:
        up = 'framerate=fps=30,'
    z = opt.get('zoom', 1)
    crop = f'crop=iw/{z}:ih/{z},' if z != 1 else ''
    grade = 'eq=brightness=0.07:saturation=1.15:gamma=1.15,' if name == 'chase' else ''
    punch = f",scale=w='trunc(iw*(1+0.06*exp(-mod(t,{BEAT})*11))/2)*2':h=-2:eval=frame,crop={W}:{H}" if opt.get('punch') else ''
    vf = f'{up}{grade}{crop}scale={W}:{H}:flags=lanczos{punch},{GRADE},setsar=1,format=yuv420p'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(src), '-start_number', str(round(off * (FPS if opt.get('slow') else src))), '-i', f'{d}/f%04d.png',
                    '-vf', vf, '-frames:v', str(round(ln * FPS)), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), out], check=True)
with open(f'{T}/list.txt', 'w') as f:
    f.write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{T}/list.txt', '-c', 'copy', f'{T}/video.mp4'], check=True)

at = {n: starts[i] for i, (n, *_r) in reversed(list(enumerate(segs)))}
open_end = starts[4]  # cold open ends, logo lands
drop = at['launch'] + 3.2  # green light
end = at['t4-end']
# (card, in, out, pop): cards pop in (scale kick) and fade out.
cards = [('logo', open_end, open_end + 3.0), ('cap-build', at['t2-street'] + 0.1, at['t3-night'] + 1.5),
         ('cap-cars', at['car-tomahawk'] + 0.1, at['launch'] - 0.1), ('cap-weather', starts[15] + 0.05, starts[15] + 1.55),
         ('cap-live', at['duel-rio'] + 0.05, at['duel-rio'] + 1.55), ('cap-world', at['w-giza'] + 0.05, at['w-giza'] + 3.15),
         ('end', end + 0.3, total)]
inputs = ['-i', f'{T}/video.mp4']
fc, last = [], '0:v'
for k, (c, a, b) in enumerate(cards, 1):
    inputs += ['-loop', '1', '-t', str(total), '-framerate', str(FPS), '-i', f'{OV}/{O}-{c}.png']
    fo = f',fade=t=out:st={b - 0.15}:d=0.15:alpha=1' if b < total - 0.01 else ''
    fc.append(f"[{k}:v]format=rgba,fade=t=in:st={a}:d=0.08:alpha=1{fo},scale=w='trunc(iw*(1+0.3*max(0,1-(t-{a})/0.18))/2)*2':h=-2:eval=frame[o{k}]")
    fc.append(f"[{last}][o{k}]overlay=x='(W-w)/2':y='(H-h)/2':format=auto[v{k}]")
    last = f'v{k}'
# White flashes on the hits: the logo, the drop, the end card.
n = len(cards) + 1
for j, ft in enumerate([open_end, drop, end]):
    inputs += ['-f', 'lavfi', '-i', f'color=c=white:s={W}x{H}:d=0.3:r={FPS}']
    fc.append(f"[{n + j}:v]format=rgba,fade=t=out:st=0:d=0.3:alpha=1,setpts=PTS+{ft}/TB[f{j}]")
    fc.append(f"[{last}][f{j}]overlay=eof_action=pass:format=auto[w{j}]")
    last = f'w{j}'
fc.append(f"[{last}]fade=t=in:st=0:d=0.15,fade=t=out:st={total - 0.8}:d=0.8,format=yuv420p[vout]")
m = n + 3
# Audio: two bars of the drop for the cold open, then the build's last 8 bars into the drop proper.
fc.append(f'[{m}:a]atrim=start={DROP}:duration={open_end},asetpts=PTS-STARTPTS[a1]')
fc.append(f'[{m + 1}:a]atrim=start={DROP - (drop - open_end)}:duration={total - open_end},asetpts=PTS-STARTPTS[a2]')
fc.append(f'[a1][a2]concat=n=2:v=0:a=1,afade=t=out:st={total - 2.4}:d=2.4[aout]')
out = f'{WORK}/cartopia-trailer-{"16x9" if O == "L" else "9x16"}.mp4'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *inputs, '-i', MUSIC, '-i', MUSIC, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(total), out], check=True)
print(out, total, 'drop at', drop)
