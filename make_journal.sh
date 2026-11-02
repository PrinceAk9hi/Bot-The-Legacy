#!/usr/bin/env bash
# Génère les animations "Journal du QG — Recrutement ouvert / fermé" (GIF + MP4)
# Usage : bash make_journal.sh
set -e
cd "$(dirname "$0")"
source scripts/fonts.sh
mkdir -p out/tmp
INK=0x1c1a17; PAPER=0xefe5cc; GREY=0x8f887b
PW=660; PH=400            # taille de la page
D=5                       # durée de la boucle (s)
SPIN=1.2                  # durée de l'arrivée en tournoyant
STAMP=1.7                 # moment du coup de tampon

# Faux paragraphes : barres grises de longueur variable
bars() {
  local x0=$1 y0=$2 w=$3 n=$4 seed=$5 out="" i len
  for ((i=0; i<n; i++)); do
    len=$(( w - ((i*37 + seed*13) % 5 == 0 ? 0 : (i*53 + seed*29) % 38) ))
    (( (i+seed) % 6 == 5 )) && len=$(( w * 3 / 5 ))
    out+="drawbox=x=$x0:y=$((y0 + i*11)):w=$len:h=4:c=$GREY:t=fill,"
  done
  printf '%s' "$out"
}

make() {
  local name=$1 stampcolor=$2 headline=$3 sub=$4 status=$5
  printf '%s' "N° 042   ·   ÉDITION SPÉCIALE   ·   PRIX : 1 CRÉDIT" > out/tmp/top.txt
  printf '%s' "$headline" > out/tmp/head.txt
  printf '%s' "$sub"      > out/tmp/sub.txt
  printf '%s' "$status"   > out/tmp/stamp.txt
  printf '%s' "PAR LA RÉDACTION" > out/tmp/by.txt
  printf '%s' "Le QG, hier soir." > out/tmp/cap.txt

  # 1) La une (image fixe)
  cat > out/tmp/page.txt <<F
color=c=${PAPER}:s=${PW}x${PH}:d=1,format=rgb24,
noise=alls=14:allf=0,
drawbox=x=8:y=8:w=iw-16:h=ih-16:c=${INK}@0.8:t=1,
drawtext=fontfile=fonts/georgia.ttf:textfile=out/tmp/top.txt:fontsize=11:fontcolor=${INK}:x=(w-tw)/2:y=18,
drawbox=x=24:y=36:w=iw-48:h=1:c=${INK}:t=fill,
drawtext=fontfile=fonts/OLDENGL.TTF:text='Le Journal du QG':fontsize=54:fontcolor=${INK}:x=(w-tw)/2:y=42,
drawbox=x=24:y=104:w=iw-48:h=3:c=${INK}:t=fill,
drawbox=x=24:y=110:w=iw-48:h=1:c=${INK}:t=fill,
drawtext=fontfile=fonts/BOD_BLAR.TTF:textfile=out/tmp/head.txt:fontsize=41:fontcolor=${INK}:x=(w-tw)/2:y=126,
drawtext=fontfile=fonts/georgiai.ttf:textfile=out/tmp/sub.txt:fontsize=16:fontcolor=${INK}:x=(w-tw)/2:y=184,
drawbox=x=24:y=212:w=iw-48:h=1:c=${INK}:t=fill,
drawtext=fontfile=fonts/georgiab.ttf:textfile=out/tmp/by.txt:fontsize=10:fontcolor=${INK}:x=24:y=222,
$(bars 24 238 190 13 1)
drawbox=x=232:y=222:w=196:h=136:c=${INK}@0.25:t=fill,
drawgrid=x=232:y=222:w=6:h=6:t=1:c=${INK}@0.12,
drawbox=x=232:y=222:w=196:h=136:c=${INK}:t=1,
drawtext=fontfile=fonts/georgiai.ttf:textfile=out/tmp/cap.txt:fontsize=11:fontcolor=${INK}:x=232:y=364,
$(bars 446 222 190 15 4)
drawbox=x=0:y=0:w=1:h=1:c=${PAPER}:t=fill
F
  ffmpeg -v error -y -/filter_complex out/tmp/page.txt -frames:v 1 out/tmp/page.png

  # 2) Le tampon (fond transparent, légèrement usé)
  ffmpeg -v error -y -f lavfi -i "color=c=black:s=320x120:d=1" -f lavfi -i "color=c=${stampcolor}:s=320x120:d=1" -filter_complex "[0]format=gray,drawbox=x=6:y=6:w=iw-12:h=ih-12:c=white:t=7,drawbox=x=16:y=16:w=iw-32:h=ih-32:c=white:t=2,drawtext=fontfile=fonts/STENCIL.TTF:textfile=out/tmp/stamp.txt:fontsize=70:fontcolor=white:x=(w-tw)/2:y=(h-th)/2+2,geq=lum='lum(X,Y)*if(lt(random(1),0.18),0.35,0.92)'[m];[1]format=rgba[c];[c][m]alphamerge,rotate=a=-0.21:ow=rotw(0.21):oh=roth(0.21):c=none" -frames:v 1 out/tmp/stamp.png

  # 3) Animation image par image : le journal arrive en tournoyant, puis coup de tampon
  ffmpeg -v error -y -f lavfi -i "color=c=0x241b14:s=800x450:d=1,vignette=angle=PI/3.2" -frames:v 1 out/tmp/bg.png
  local nf=$(awk "BEGIN{print int((${STAMP}+0.2)*25)}") f
  for ((f=0; f<=nf; f++)); do
    read pw ang sw <<<"$(awk -v t=$(awk "BEGIN{print $f/25}") -v sp=${SPIN} -v st=${STAMP} -v pw=${PW} "BEGIN{
      p=t/sp; if(p>1)p=1; e=1-(1-p)^3;
      w=int(pw*(0.03+0.97*e)/2)*2; if(w<4)w=4;
      a=-0.03+(1-e)*4*3.14159265;
      q=(t-st)/0.14; if(q<0)q=0; if(q>1)q=1;
      print w, a, (t<st ? 0 : int(334*(2.6-1.6*q)/2)*2) }")"
    local stampf="[x]null[out]"
    (( sw > 0 )) && stampf="[2]scale=${sw}:-2[s];[x][s]overlay=530-w/2:305-h/2[out]"
    ffmpeg -v error -y -i out/tmp/bg.png -i out/tmp/page.png -i out/tmp/stamp.png -filter_complex       "[1]format=rgba,scale=${pw}:-2,rotate=a=${ang}:ow=rotw(${ang}):oh=roth(${ang}):c=none[p];[0][p]overlay=(W-w)/2:(H-h)/2[x];${stampf}"       -map "[out]" -frames:v 1 out/tmp/f$(printf %03d $f).png
  done
  local hold=$(awk "BEGIN{print ${D} - ($nf+1)/25}")
  ffmpeg -v error -y -framerate 25 -i out/tmp/f%03d.png -filter_complex     "tpad=stop_mode=clone:stop_duration=${hold},split[a][b];[a]fps=20,split[g1][g2];[g1]palettegen=max_colors=128:stats_mode=diff[p];[g2][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle[gif];[b]format=yuv420p[mp4]"     -map "[gif]" -loop 0 "out/journal_qg_recrutement_${name}.gif"     -map "[mp4]" -c:v libx264 -crf 18 -movflags +faststart "out/journal_qg_recrutement_${name}.mp4"
  rm -f out/tmp/f*.png
  echo "ok: $name"
}

make ouvert 0x1d7a3a "RECRUTEMENT OUVERT !" "Le QG ouvre ses portes : les candidatures sont acceptées dès aujourd'hui." "OUVERT"
make ferme  0xb8262b "RECRUTEMENT FERMÉ"     "Les portes du QG sont closes jusqu'à nouvel ordre. Revenez plus tard."     "FERMÉ"
rm -rf out/tmp
