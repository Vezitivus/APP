#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p tests/e2e/clips tests/e2e/dist/clips
for item in "red #E24B4B" "gold #E0C27A" "blue #4B7BE2"; do
  set -- $item
  name=$1
  color=$2
  out="tests/e2e/clips/${name}.mp4"
  if [ ! -s "$out" ]; then
    ffmpeg -y -hide_banner -loglevel error \
      -f lavfi -i "color=c=${color}:s=960x540:d=1.2,drawbox=x='w*0.1+t*400':y=210:w=140:h=140:c=white:t=fill" \
      -pix_fmt yuv420p -c:v libx264 -preset ultrafast -movflags +faststart "$out"
  fi
done
cp tests/e2e/index.html tests/e2e/dist/index.html
cp tests/e2e/clips/*.mp4 tests/e2e/dist/clips/
npx esbuild tests/e2e/crossfade-app.tsx --bundle --outfile=tests/e2e/dist/app.js --format=iife --platform=browser --jsx=automatic --target=es2022
npx tsx tests/e2e/crossfade.spec.ts
