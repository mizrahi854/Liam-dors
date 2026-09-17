#!/usr/bin/env python3
"""Encode rendered door-film masters to H.264 MP4.

Reads  design/renders/door-film/<set>/NNNN.jpg   (written by site/dist/lab/door-film/render.html)
Writes site/dist/media/door-film/liam-door-film-<set>.mp4

Usage: python3 site/scripts/encode-door-film.py [portrait|landscape ...]
Needs OpenCV (cv2) with AVFoundation H.264 ("avc1"), available on macOS builds.
"""
import sys
from pathlib import Path
import cv2

project = Path(__file__).resolve().parents[2]
sets = sys.argv[1:] or ['portrait', 'landscape']
for name in sets:
    frames = sorted((project / 'design/renders/door-film' / name).glob('[0-9][0-9][0-9][0-9].jpg'))
    if not frames:
        print(f'{name}: no frames, render first'); continue
    first = cv2.imread(str(frames[0]))
    h, w = first.shape[:2]
    out = project / 'site/dist/media/door-film' / f'liam-door-film-{name}.mp4'
    out.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*'avc1'), 30, (w, h))
    if not writer.isOpened():
        sys.exit('H.264 writer unavailable in this OpenCV build')
    for path in frames:
        writer.write(cv2.imread(str(path)))
    writer.release()
    print(f'{name}: {len(frames)} frames {w}x{h} → {out.relative_to(project)} ({out.stat().st_size / 1e6:.1f} MB)')
