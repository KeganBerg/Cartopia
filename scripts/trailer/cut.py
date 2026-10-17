# Cuts the launch trailer (16:9 = L, 9:16 = P) from the frame folders shoot.mjs and town.mjs record,
# the caption cards overlays.mjs draws, and the Rave Mode track, cutting on its 1.6 s bars.
# python3 scripts/trailer/cut.py L|P   (dirs via TRAILER=<work dir>, MUSIC=<mp3 of the Rave Mode track>)
import subprocess, sys, os
O = sys.argv[1]
W, H = (1920, 1080) if O == 'L' else (1080, 1920)
WORK = os.environ.get('TRAILER', '/tmp/trailer')
S = f'{WORK}/shots'
T = f'{WORK}/cut-{O}'
os.makedirs(T, exist_ok=True)
FPS = 30
# (shot, offset into shot s, length s) on 150 bpm bars of 1.6 s
cars = ['monoposto', 'tomahawk', 'camper', 'zenith', 'schoolbus', 'hyper', 'bug', 'stomper']
world = ['giza', 'moscow', 'rio', 'rome', 'vegas', 'london', 'sydney', 'shanghai', 'jaipur']
segs = [('t1-reveal', 0.25, 3.2), ('t2-street', 0.25, 3.2), ('t3-night', 0.25, 3.2)]
segs += [(f'car-{c}', 0.2, 0.8) for c in cars]
segs += [('gp', 0.2, 3.2), ('pass', 0.3, 3.2), ('low', 0.2, 3.2), ('drone', 0.2, 3.2), ('launch', 0.0, 4.8)]
segs += [(f'w-{v}', 0.3, 0.8) for v in world]
segs += [('chase', float(os.environ.get('CHASE', '0.6')), 1.6), ('t4-end', 0.0, 5.6)]
# Front three-quarter car shots sit back from the car (the orbit keeps off the kerb), so they're cropped in.
ZOOM = {**({'launch': 1.3} if O == 'L' else {}), **{f'car-{c}': (1.7 if O == 'L' else 1.5) for c in ['monoposto', 'camper', 'zenith', 'schoolbus', 'bug', 'stomper']}, 'car-tomahawk': 1.15, 'car-hyper': 1.15}
parts = []
for i, (name, off, ln) in enumerate(segs):
    d = f'{S}/{O}-{name}'
    out = f'{T}/{i:02d}.mp4'
    parts.append(out)
    n = round(ln * FPS)
    # Town shots may be drawn at 15 fps (the full game is slow to draw); those are blended up to 30.
    frames = len([f for f in os.listdir(d) if f.endswith('.png')])
    src = 15 if name.startswith('t') and frames < 90 else FPS
    if name == 't4-end':
        src = 10.5  # 4 s of drift stretched under the end card
    zoom = ZOOM.get(name, 1)
    crop = f'crop=iw/{zoom}:ih/{zoom},' if zoom != 1 else ''
    grade = 'eq=brightness=0.07:saturation=1.15:gamma=1.15,' if name == 'chase' else ''
    up = 'framerate=fps=30,' if src != FPS else ''
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(src), '-start_number', str(round(off * src)), '-i', f'{d}/f%04d.png', '-frames:v', str(n),
                    '-vf', f'{up}{grade}{crop}scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), out], check=True)
with open(f'{T}/list.txt', 'w') as f:
    f.write(''.join(f"file '{p}'\n" for p in parts))
total = sum(s[2] for s in segs)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{T}/list.txt', '-c', 'copy', f'{T}/video.mp4'], check=True)
ov = f'{WORK}/ov'
# (overlay, in, out)
cards = [('logo', 0.5, 3.0), ('cap-build', 3.5, 6.2), ('cap-cars', 9.9, 15.8), ('cap-weather', 19.4, 22.2), ('cap-live', 25.8, 28.6), ('cap-world', 33.7, 37.0), ('end', 42.9, total)]
inputs = ['-i', f'{T}/video.mp4']
for c, a, b in cards:
    inputs += ['-loop', '1', '-t', str(total), '-framerate', str(FPS), '-i', f'{ov}/{O}-{c}.png']
fc = []
last = '0:v'
for k, (c, a, b) in enumerate(cards, 1):
    fo = min(b, total - 0.01) - 0.2
    fc.append(f'[{k}:v]format=rgba,fade=t=in:st={a}:d=0.2:alpha=1' + (f',fade=t=out:st={fo}:d=0.2:alpha=1' if b < total else '') + f'[o{k}]')
    fc.append(f'[{last}][o{k}]overlay=0:0:format=auto[v{k}]')
    last = f'v{k}'
fc.append(f'[{last}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.7}:d=0.7,format=yuv420p[vout]')
# The track's drop lands at 58.0 s; starting at 26.0 puts it on bar 20 (0:32), the green light.
music = os.environ.get('MUSIC', '/mnt/project-files/ambience/techno/rave-mode-buildup-and-drop.mp3')
fc.append(f'[{len(cards) + 1}:a]atrim=start=26.0:duration={total},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st={total - 2.2}:d=2.2[aout]')
out = f'{WORK}/cartopia-trailer-{"16x9" if O == "L" else "9x16"}.mp4'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *inputs, '-i', music, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(total), out], check=True)
print(out, total)
