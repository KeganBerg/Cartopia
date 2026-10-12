# Club A/V capture

Renders the nightclub's music offline and films the club lit by the same cues,
so the lights can be checked against the sound. Needs `npx vite` on :5173.

    node scripts/clubav/audio.mjs <set bar> <seconds> out.wav cues.json
    node scripts/clubav/frames.mjs cues.json <frames dir> <set bar> <seconds> 60
    ffmpeg -framerate 60 -i <frames dir>/f%04d.png -i out.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest club.mp4
