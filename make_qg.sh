#!/usr/bin/env bash
# Génère les animations "QG — Recrutement ouvert / fermé" (GIF + MP4)
# Usage : bash make_qg.sh
set -e
cd "$(dirname "$0")"
source scripts/fonts.sh
W=800; H=300; D=4; BG=0x0a0e13

make() {
  local name=$1 color=$2 status=$3 footer=$4 pulse=$5
  local n=$(printf '%s' "$footer" | wc -m)
  local tw=$(( n * 99 / 10 ))            # largeur approx. Consolas 18px
  printf '%s' "QG // QUARTIER GÉNÉRAL" > out/.h.txt
  printf '%s' "$status" > out/.s.txt
  printf '%s' "$footer" > out/.f.txt
  cat > out/.filter.txt <<F
color=c=${BG}:s=${W}x${H}:r=25:d=${D},format=rgb24,
drawgrid=w=40:h=40:t=1:c=${color}@0.07,
drawbox=x=0:y=0:w=iw:h=ih:c=${color}@0.5:t=2,
drawbox=x=20:y=20:w=30:h=4:c=${color}:t=fill,drawbox=x=20:y=20:w=4:h=30:c=${color}:t=fill,

drawbox=x=40:y=246:w=720:h=28:c=${BG}:t=fill,
drawtext=fontfile=fonts/consolab.ttf:textfile=out/.h.txt:fontsize=18:fontcolor=${color}:x=60:y=36,
drawtext=fontfile=fonts/consolab.ttf:text='SYS-STATUS':fontsize=16:fontcolor=${color}@0.6:x=w-tw-60:y=38,
drawbox=x=626:y=38:w=12:h=12:c=${color}:t=fill:enable='lt(mod(t,1),0.5)',
drawtext=fontfile=fonts/impact.ttf:text='RECRUTEMENT':fontsize=78:fontcolor=white:x=56:y=72:shadowcolor=${color}@0.5:shadowx=4:shadowy=4,
drawtext=fontfile=fonts/impact.ttf:textfile=out/.s.txt:fontsize=78:fontcolor=cyan@0.6:x=66:y=158:enable='between(mod(t,${D}),2.0,2.08)+between(mod(t,${D}),3.3,3.36)',
drawtext=fontfile=fonts/impact.ttf:textfile=out/.s.txt:fontsize=78:fontcolor=${color}:x=58:y=156:alpha='${pulse}':box=1:boxcolor=${color}@0.12:boxborderw=8|22,
drawtext=fontfile=fonts/consolab.ttf:textfile=out/.f.txt:fontsize=18:fontcolor=white@0.9:x=60:y=252[base];
color=c=${color}:s=12x22:r=25:d=${D}[cur];
color=c=${BG}:s=800x22:r=25:d=${D}[blank];
[cur][blank]hstack[cover];
[base][cover]overlay=x='60+min(t*420\,${tw})':y=250:enable='lt(t\,${tw}/420)+lt(mod(t\,0.8)\,0.4)',
drawbox=x=0:y=0:w=iw:h=ih:c=${color}@0.5:t=2,drawbox=x=750:y=276:w=30:h=4:c=${color}:t=fill,drawbox=x=776:y=250:w=4:h=30:c=${color}:t=fill,
rgbashift=rh=-6:bh=6:enable='between(mod(t,${D}),2.0,2.08)+between(mod(t,${D}),3.3,3.36)',
split[a][b];
[a]fps=20,split[g1][g2];[g1]palettegen=max_colors=96:stats_mode=full[p];[g2][p]paletteuse=dither=bayer:bayer_scale=4[gif];
[b]format=yuv420p[mp4]
F
  ffmpeg -v error -y -/filter_complex out/.filter.txt -map '[gif]' -loop 0 "out/qg_recrutement_${name}.gif" \
         -map '[mp4]' -c:v libx264 -crf 18 -movflags +faststart "out/qg_recrutement_${name}.mp4"
  echo "ok: $name"
}

make ouvert 0x22ff88 "OUVERT" "> CANDIDATURES ACCEPTÉES — REJOINS LE QG" '0.8+0.2*sin(2*PI*t)'
make ferme  0xff3344 "FERMÉ"  "> ACCÈS RESTREINT — REVIENS PLUS TARD"   'if(lt(mod(t,1),0.6),1,0.45)'
rm -f out/.*.txt
