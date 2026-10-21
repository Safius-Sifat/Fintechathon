#!/bin/bash
# Logs a timestamped step name while recording the demo; build.py uses the times.
python3 -c 'import time,sys;print(f"{time.time():.2f}",sys.argv[1])' "$1" >> "$(dirname "$0")/steps.log"
