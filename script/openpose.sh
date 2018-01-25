#!/bin/bash
PROG=$(basename "$0")
CWD=$(dirname $(realpath "$0"))

if [ $# -ne 3 ]; then
  cat >&2 <<EOF
Usage:
  $PROG [gpuId] [mp4file] [workdir]
Example:
  $PROG 0 /path/to/mp4 /path/to/workdir
EOF
  exit 1
fi

NV_GPU="$1"
MP4_FILE="$2"
WORKDIR="$3"

SRCDIR=$(dirname "$MP4_FILE")
_UID=$(id -u $(whoami))
_GID=$(id -g $(whoami))

date

time env NV_GPU=$NV_GPU nvidia-docker run --rm -ti -u "$_UID":"$_GID" -v "$SRCDIR":"$SRCDIR" -v "$WORKDIR":"$WORKDIR" --workdir /opt/openpose-docker openpose-docker:latest \
    ./build/examples/openpose/openpose.bin --no_display=1 --num_gpu=1 \
        --video "$MP4_FILE" \
        --write_video="$WORKDIR/result.mp4" \
        --write_json="$WORKDIR/result_dir"

#python3 "$CWD/convert.py" --input_dir "$WORKDIR/result_dir" --output "$WORKDIR/result.json"

echo "done"
