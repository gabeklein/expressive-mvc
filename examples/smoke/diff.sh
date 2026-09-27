#!/bin/bash
# Compare DOM trails between renderers: smoke/diff.sh [pattern]
cd "$(dirname "$0")/out" || exit 1
fmt() { perl -0pe "s/<!--.*?-->//gs" "$1" | perl -pe "s/</\n</g; s/>/>\n/g" | sed '/^\s*$/d'; }
status=0
for f in react/*${1}*.html; do
  n=${f#react/}
  [ -f "dom/$n" ] || { echo "== $n: missing dom trail"; continue; }
  d=$(diff -u <(fmt "$f") <(fmt "dom/$n") | tail -n +3)
  if [ -n "$d" ]; then
    status=1
    echo "== $n"
    echo "$d" | head -${LINES:-40}
  fi
done
exit $status
