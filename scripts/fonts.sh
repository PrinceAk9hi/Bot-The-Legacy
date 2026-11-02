# Polices Windows utilisées par les bannières : copiées localement dans fonts/
# (ffmpeg gère mal les chemins « C:\… »). Elles ne sont pas redistribuées dans le dépôt.
mkdir -p fonts
for f in BOD_BLAR.TTF OLDENGL.TTF STENCIL.TTF bahnschrift.ttf consolab.ttf georgia.ttf georgiab.ttf georgiai.ttf impact.ttf; do
  [ -f "fonts/$f" ] || cp "${WINDIR:-C:/Windows}/Fonts/$f" "fonts/$f" || { echo "Police manquante : $f" >&2; exit 1; }
done
