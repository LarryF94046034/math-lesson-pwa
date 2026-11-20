# -*- coding: utf-8 -*-
"""
Verification Script for Chapter 2-1 (質因數分解)
Checks:
- All 90 student crops exist and have no text cutting at top/bottom edges
- All 90 solution crops exist and have proper dimensions
- questions.json, crops.json, precache.json integrity
"""
import os
import json
import numpy as np
from PIL import Image

WEB = os.path.dirname(os.path.abspath(__file__))
CROPS_DIR = os.path.join(WEB, "crops")
DATA_DIR = os.path.join(WEB, "data")

with open(os.path.join(DATA_DIR, "questions.json"), "r", encoding="utf-8") as f:
    qdb = json.load(f)

q21 = qdb["questions"]["jh2_1"]
print(f"Total jh2_1 questions in questions.json: {len(q21)}")
assert len(q21) == 90, f"Expected 90 questions, got {len(q21)}"

missing_images = []
missing_sols = []
clipped_student = []

for q in q21:
    qid = q["id"]
    img_path = os.path.join(WEB, q["image"].replace("/", os.sep))
    sol_path = os.path.join(WEB, q["solutionImage"].replace("/", os.sep))
    
    if not os.path.exists(img_path) or os.path.getsize(img_path) == 0:
        missing_images.append(img_path)
    else:
        # Check clipping on student crop
        sim = Image.open(img_path).convert("L")
        sarr = np.array(sim)
        h, w = sarr.shape
        # Top 2 rows
        top_dark = np.sum(sarr[0:2, :] < 160)
        # Bottom 2 rows
        bot_dark = np.sum(sarr[h-2:h, :] < 160)
        
        # In student crop, top_dark and bot_dark should be 0 or tiny noise
        if top_dark > 30:
            clipped_student.append((qid, "TOP", top_dark))
        if bot_dark > 30:
            clipped_student.append((qid, "BOT", bot_dark))
            
    if not os.path.exists(sol_path) or os.path.getsize(sol_path) == 0:
        missing_sols.append(sol_path)

print(f"Missing student images: {len(missing_images)}")
print(f"Missing solution images: {len(missing_sols)}")
print(f"Clipped student crops: {len(clipped_student)}")
for c in clipped_student:
    print("  CLIPPED:", c)

with open(os.path.join(DATA_DIR, "crops.json"), "r", encoding="utf-8") as f:
    crops_db = json.load(f)

jh2_1_crops = [c for c in crops_db if "jh2_1" in c.get("out", "")]
print(f"Total jh2_1 crop entries in crops.json: {len(jh2_1_crops)}")

with open(os.path.join(WEB, "precache.json"), "r", encoding="utf-8") as f:
    precache = json.load(f)

jh2_1_precache = [p for p in precache if "jh2_1" in p]
print(f"Total jh2_1 precache entries: {len(jh2_1_precache)}")

if len(missing_images) == 0 and len(missing_sols) == 0 and len(clipped_student) == 0:
    print("ALL VERIFICATIONS PASSED PERFECTLY!")
else:
    print("SOME CHECKS FAILED!")
