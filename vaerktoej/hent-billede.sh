#!/bin/sh
# Brug: vaerktoej/hent-billede.sh <navn> <seed> "<prompt>"
# Henter et billede fra Pollinations med den faelles stil-hale fra grafik-plan.md
# og gemmer det i vaerktoej/raa/ (som ikke committes). Kraever at
# image.pollinations.ai er aabnet i miljoeets netvaerksindstillinger.
navn=$1; seed=$2; prompt=$3
hale="warm hand-painted children's book illustration, thick soft brushstrokes, visible paper texture, gentle warm daylight, friendly rounded shapes, expressive face, full body, centered, plain flat white background, no text, no border, no shadow on the ground"
enc=$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$prompt, $hale")
mkdir -p "$(dirname "$0")/raa"
curl -sS -L --max-time 180 -o "$(dirname "$0")/raa/$navn.png" -w "$navn: HTTP %{http_code} %{size_download} B\n" \
  "https://image.pollinations.ai/prompt/$enc?width=1024&height=1024&seed=$seed&model=flux&nologo=true"
