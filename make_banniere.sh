#!/usr/bin/env bash
# Bannières animées "Le Journal du QG" : recrutement ouvert / fermé et support (GIF + MP4)
# Le GIF joue l'animation une seule fois puis reste sur la une finale (pas de boucle).
# Usage : bash make_banniere.sh
set -e
cd "$(dirname "$0")"
T=out/tmp; mkdir -p $T
INK=0x1c1a17; PAPER=0xece2c8; GREY=0x948c7e
PW=1320; PH=440          # page rendue (zoomée/recadrée ensuite)
OW=960;  OH=320          # bannière finale (3:1)
D=5                      # durée de la boucle (s)
T1=0.85; T2=1.25; TS=2.0 # mot 1, mot 2, tampon

# Largeur réelle (en px) d'un texte rendu avec une police et une taille
measure() {
  printf '%s' "$3" > $T/m.txt
  ffmpeg -v info -f lavfi -i "color=c=black:s=3000x300:d=0.04,format=gray" \
    -vf "drawtext=fontfile=$1:textfile=$T/m.txt:fontsize=$2:fontcolor=white:x=10:y=10,bbox" \
    -f null - 2>&1 | grep -o ' w:[0-9]*' | head -1 | cut -d: -f2
}

# Faux paragraphes : barres grises de longueur variable
bars() {
  local x0=$1 y0=$2 w=$3 n=$4 seed=$5 out="" i len
  for ((i=0; i<n; i++)); do
    len=$(( w - ((i*37 + seed*13) % 5 == 0 ? 0 : (i*53 + seed*29) % 46) ))
    (( (i+seed) % 6 == 5 )) && len=$(( w * 3 / 5 ))
    out+="drawbox=x=$x0:y=$((y0 + i*14)):w=$len:h=5:c=$GREY:t=fill,"
  done
  printf '%s' "$out"
}

# Calque transparent plein format contenant un texte, + version agrandie (effet "claque")
textlayer() { # out font size x y color textfile
  ffmpeg -v error -y -f lavfi -i "color=c=black@0:s=${PW}x${PH}:d=0.04,format=rgba" \
    -vf "drawtext=fontfile=$2:textfile=$7:fontsize=$3:fontcolor=$6:x=$4:y=$5:y_align=font:shadowcolor=black@0.25:shadowx=3:shadowy=3" \
    -frames:v 1 $T/$1.png
}
biglayer() { # in out factor cx cy
  local W2 H2
  W2=$(awk "BEGIN{print int($PW*$3/2)*2}"); H2=$(awk "BEGIN{print int($PH*$3/2)*2}")
  ffmpeg -v error -y -i $T/$1.png -vf "scale=$W2:$H2,crop=$PW:$PH:$(awk "BEGIN{print int($4*$3-$4)}"):$(awk "BEGIN{print int($5*$3-$5)}"),colorchannelmixer=aa=0.7" \
    -frames:v 1 $T/$2.png
}

make() {
  local name=$1 stampcolor=$2 word1=$3 word2=$4 sub=$5 status=$6 edition=${7:-N° 042}
  printf '%s' "$word1"      > $T/w1.txt
  printf '%s' "$word2"      > $T/w2.txt
  printf '%s' "$sub"        > $T/sub.txt
  printf '%s' "$status"     > $T/stamp.txt
  printf '%s' "ÉDITION"     > $T/e1.txt; printf '%s' "SPÉCIALE" > $T/e2.txt
  printf '%s' "$edition"    > $T/n1.txt; printf '%s' "PRIX : 1 CRÉDIT" > $T/n2.txt

  # Titre : taille ajustée pour tenir dans la largeur, mots placés côte à côte
  local HF=fonts/BOD_BLAR.TTF
  local wf=$(measure $HF 100 "$word1 $word2")
  local hs=$(awk "BEGIN{s=int(1180*100/$wf); print (s>104?104:s)}")
  local w1=$(measure $HF $hs "$word1") wt=$(measure $HF $hs "$word1 $word2") w2=$(measure $HF $hs "$word2")
  local x0=$(( (PW - wt) / 2 )) hy=$(( 196 - hs * 7 / 10 ))
  local x2=$(( x0 + wt - w2 ))

  # 1) La une (sans le titre)
  cat > $T/page.txt <<F
color=c=${PAPER}:s=${PW}x${PH}:d=1,format=rgb24,
drawbox=x=40:y=28:w=190:h=72:c=0xb8262b:t=fill,
drawtext=fontfile=fonts/georgiab.ttf:textfile=$T/e1.txt:fontsize=20:fontcolor=${PAPER}:x=40+(190-tw)/2:y=40,
drawtext=fontfile=fonts/georgiab.ttf:textfile=$T/e2.txt:fontsize=20:fontcolor=${PAPER}:x=40+(190-tw)/2:y=68,
drawbox=x=1090:y=28:w=190:h=72:c=${INK}:t=2,
drawtext=fontfile=fonts/georgiab.ttf:textfile=$T/n1.txt:fontsize=20:fontcolor=${INK}:x=1090+(190-tw)/2:y=40,
drawtext=fontfile=fonts/georgia.ttf:textfile=$T/n2.txt:fontsize=16:fontcolor=${INK}:x=1090+(190-tw)/2:y=70,
drawtext=fontfile=fonts/OLDENGL.TTF:text='Le Journal du QG':fontsize=88:fontcolor=${INK}:x=(w-tw)/2:y=14,
drawbox=x=40:y=112:w=iw-80:h=5:c=${INK}:t=fill,
drawbox=x=40:y=121:w=iw-80:h=1:c=${INK}:t=fill,
drawtext=fontfile=fonts/georgiai.ttf:textfile=$T/sub.txt:fontsize=25:fontcolor=${INK}:x=(w-tw)/2:y=238,
drawbox=x=40:y=280:w=iw-80:h=1:c=${INK}:t=fill,
$(bars 40 294 228 11 1)
drawbox=x=293:y=294:w=228:h=146:c=${INK}@0.22:t=fill,
drawbox=x=293:y=294:w=228:h=150:c=${INK}:t=2,
$(bars 546 294 228 11 2)
$(bars 799 294 228 11 3)
$(bars 1052 294 228 11 4)
drawbox=x=280:y=290:w=1:h=150:c=${INK}@0.5:t=fill,drawbox=x=533:y=290:w=1:h=150:c=${INK}@0.5:t=fill,
drawbox=x=786:y=290:w=1:h=150:c=${INK}@0.5:t=fill,drawbox=x=1039:y=290:w=1:h=150:c=${INK}@0.5:t=fill
F
  ffmpeg -v error -y -/filter_complex $T/page.txt -frames:v 1 $T/page.png

  # 2) Les mots du titre + versions agrandies
  textlayer w1 $HF $hs $x0 $hy $INK $T/w1.txt
  textlayer w2 $HF $hs $x2 $hy $INK $T/w2.txt
  biglayer w1 w1big 1.35 $(( x0 + w1/2 )) 180
  biglayer w2 w2big 1.35 $(( x2 + w2/2 )) 180

  # 3) Le tampon (masque usé + couleur), placé sur la page, + 2 tailles pour l'impact
  local sw=$(measure fonts/STENCIL.TTF 104 "$status")
  local ss=$(awk "BEGIN{s=int(400*104/$sw); print (s>140?140:s)}")
  ffmpeg -v error -y -f lavfi -i "color=c=black:s=480x170:d=1" -f lavfi -i "color=c=${stampcolor}:s=480x170:d=1" -filter_complex "\
[0]format=gray,drawbox=x=8:y=8:w=iw-16:h=ih-16:c=white:t=10,\
drawbox=x=24:y=24:w=iw-48:h=ih-48:c=white:t=3,\
drawtext=fontfile=fonts/STENCIL.TTF:textfile=$T/stamp.txt:fontsize=$ss:fontcolor=white:x=(w-tw)/2:y=(h-th)/2+3,\
geq=lum='lum(X,Y)*if(lt(random(1),0.2),0.3,0.93)'[m];\
[1]format=rgba[c];[c][m]alphamerge,\
rotate=a=-0.17:ow=rotw(0.17):oh=roth(0.17):c=none" -frames:v 1 $T/stamp0.png
  local SCX=1030 SCY=335
  ffmpeg -v error -y -f lavfi -i "color=c=black@0:s=${PW}x${PH}:d=0.04,format=rgba" -i $T/stamp0.png \
    -filter_complex "[0][1]overlay=$SCX-w/2:$SCY-h/2" -frames:v 1 $T/stamp.png
  biglayer stamp stampbig 1.9 $SCX $SCY
  biglayer stamp stampmid 1.3 $SCX $SCY

  # 4) Montage : zoom caméra sur le titre du journal puis recul, mots qui claquent, tampon + secousses
  local f="on/25"
  local E="(1-pow(1-min(${f}/0.7,1),3))"                       # recul de la caméra (easing)
  local Z="if(lt(${f},0.7), 2.3-1.25*${E}, 1.05)"
  local SH="(10*gte(${f},$T1)*exp(-(${f}-$T1)*16)+12*gte(${f},$T2)*exp(-(${f}-$T2)*16)+26*gte(${f},$TS)*exp(-(${f}-$TS)*13))"
  local CY="(64+(${PH}/2-64)*${E})"
  cat > $T/anim.txt <<F
[0][2]overlay=enable='between(t,$T1,$T1+0.079)'[a1];
[a1][1]overlay=enable='gte(t,$T1+0.08)'[a2];
[a2][4]overlay=enable='between(t,$T2,$T2+0.079)'[a3];
[a3][3]overlay=enable='gte(t,$T2+0.08)'[a4];
[a4][6]overlay=enable='between(t,$TS,$TS+0.039)'[a5];
[a5][7]overlay=enable='between(t,$TS+0.04,$TS+0.079)'[a6];
[a6][5]overlay=enable='gte(t,$TS+0.08)',format=rgb24,
zoompan=z='${Z}':d=1:fps=25:s=${OW}x${OH}:
x='floor(max(0,min(iw-iw/zoom, iw/2-iw/zoom/2 + ${SH}*sin(on*2.1))))':
y='floor(max(0,min(ih-ih/zoom, ${CY}-ih/zoom/2 + ${SH}*cos(on*2.7))))',
vignette=angle=PI/4.5:eval=init,
split[a][b];
[a]fps=20,mpdecimate=max=0,split[g1][g2];[g1]palettegen=max_colors=128:stats_mode=full[p];[g2][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[gif];
[b]format=yuv420p[mp4]
F
  local in=""; for l in page w1 w1big w2 w2big stamp stampbig stampmid; do in+=" -loop 1 -framerate 25 -t $D -i $T/$l.png"; done
  ffmpeg -v error -y $in -/filter_complex $T/anim.txt \
    -map '[gif]' -loop -1 "out/banniere_qg_${name}.gif" \
    -map '[mp4]' -c:v libx264 -crf 18 -movflags +faststart "out/banniere_qg_${name}.mp4"
  echo "ok: $name"
}

make recrutement_ouvert 0x1d7a3a RECRUTEMENT "OUVERT !" "Le QG ouvre ses portes : les candidatures sont acceptées dès aujourd'hui." "OUVERT"
make recrutement_ferme  0xb8262b RECRUTEMENT "FERMÉ"    "Les portes du QG sont closes jusqu'à nouvel ordre. Revenez plus tard."     "FERMÉ"
make support            0x1f4e8c SERVICE     "SUPPORT"  "Une question, un souci, un projet ? Ouvre un ticket : l'équipe te répond." "QG" "N° 043"
# Copie dans les assets utilisés par les panels
cp out/banniere_qg_recrutement_ouvert.gif assets/qg-candidature-ouvert.gif
cp out/banniere_qg_recrutement_ferme.gif  assets/qg-candidature-ferme.gif
cp out/banniere_qg_support.gif            assets/qg-support.gif
rm -rf $T
