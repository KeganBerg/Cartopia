# Brand

`cartopia-logo.png` is the source logo (512x512, red Hot Shot on the orange sunburst). Site icons in
`public/` are made from it; the desktop app can reuse it for its own icon.

Rebuild the web icons after changing the logo (ImageMagick):

```sh
S=brand/cartopia-logo.png
convert $S -crop 360x360+75+79 +repage /tmp/tight.png   # tighter crop so the car reads at 16-48 px
for n in 16 32 48; do convert /tmp/tight.png -filter Lanczos -resize ${n}x$n -unsharp 0x0.6 /tmp/f$n.png; done
cp /tmp/f16.png public/icons/favicon-16.png; cp /tmp/f32.png public/icons/favicon-32.png
convert /tmp/f16.png /tmp/f32.png /tmp/f48.png public/favicon.ico
convert $S -resize 180x180 -strip public/icons/apple-touch-icon.png
convert $S -resize 192x192 -strip public/icons/icon-192.png
convert $S -strip public/icons/icon-512.png && cp public/icons/icon-512.png public/icons/icon-maskable-512.png
```
