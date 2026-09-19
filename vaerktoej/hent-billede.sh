#!/bin/sh
# Brug: vaerktoej/hent-billede.sh <navn> <seed> "<prompt>"
# Henter et billede fra Pollinations med den faelles stil-hale fra grafik-plan.md
# og gemmer det i vaerktoej/raa/ (som ikke committes). Kraever at
# image.pollinations.ai er aabnet i miljoeets netvaerksindstillinger.
#
# Pollinations giver ikke laengere gratis genereringer (svarer 402 "Insufficient
# balance"). Saet POLLINATIONS_TOKEN i miljoeet til en noegle fra
# enter.pollinations.ai, saa sendes den med. Er svaret ikke et billede, slettes
# filen igen, og fejlen skrives ud.
navn=$1; seed=$2; prompt=$3
hale="warm hand-painted children's book illustration, thick soft brushstrokes, visible paper texture, gentle warm daylight, friendly rounded shapes, expressive face, full body, centered, plain flat white background, no text, no border, no shadow on the ground"
enc=$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$prompt, $hale")
raa="$(dirname "$0")/raa"
mkdir -p "$raa"
fil="$raa/$navn.png"
auth=""
[ -n "$POLLINATIONS_TOKEN" ] && auth="-H \"Authorization: Bearer $POLLINATIONS_TOKEN\""
eval curl -sS -L --max-time 180 $auth -o "\"$fil\"" -w "\"$navn: HTTP %{http_code} %{content_type} %{size_download} B\\n\"" \
  "\"https://image.pollinations.ai/prompt/$enc?width=1024&height=1024&seed=$seed&model=flux&nologo=true\""
if ! file "$fil" | grep -q -E 'PNG|JPEG'; then
  echo "$navn: svaret var ikke et billede:" >&2
  python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('message',d))" "$fil" >&2 2>/dev/null || cat "$fil" >&2
  rm -f "$fil"
  exit 1
fi
