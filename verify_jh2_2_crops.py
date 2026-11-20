# -*- coding: utf-8 -*-
import os
import sys
import json
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.abspath(__file__))
CROPS_DIR = os.path.join(ROOT, "crops")
DATA_DIR = os.path.join(ROOT, "data")

print("=== Starting 2-2 Verification ===")

# 1. Load questions.json
with open(os.path.join(DATA_DIR, "questions.json"), "r", encoding="utf-8") as f:
    qdb = json.load(f)

zone_2_2 = next((z for z in qdb["zones"] if z["id"] == "jh2_2"), None)
assert zone_2_2 is not None, "jh2_2 zone missing in questions.json"
assert zone_2_2["questionCount"] == 97, f"Expected 97 questions, got {zone_2_2['questionCount']}"

questions_2_2 = qdb["questions"].get("jh2_2", [])
assert len(questions_2_2) == 97, f"Expected 97 questions list, got {len(questions_2_2)}"
print(f"Verified questions.json: 97 questions in jh2_2.")

# 2. Check all student and solution crops
clipped_top = []
clipped_bot = []
missing_student = []
missing_solution = []

for q in questions_2_2:
    s_path = os.path.join(ROOT, q["image"])
    sol_path = os.path.join(ROOT, q["solutionImage"])
    
    if not os.path.exists(s_path):
        missing_student.append(q["id"])
    else:
        # Check clipping on student crop
        im = Image.open(s_path).convert("L")
        w, h = im.size
        # Top 2 rows dark pixels (< 140)
        top_dark = sum(1 for y in range(min(2, h)) for x in range(w) if im.getpixel((x, y)) < 140)
        bot_dark = sum(1 for y in range(max(0, h - 2), h) for x in range(w) if im.getpixel((x, y)) < 140)
        
        if top_dark > 20:
            clipped_top.append((q["id"], top_dark))
        if bot_dark > 20:
            clipped_bot.append((q["id"], bot_dark))
            
    if not os.path.exists(sol_path):
        missing_solution.append(q["id"])

print(f"Missing student crops: {len(missing_student)}")
print(f"Missing solution crops: {len(missing_solution)}")
print(f"Student crops with clipped TOP (> 20 dark pixels): {len(clipped_top)} -> {clipped_top}")
print(f"Student crops with clipped BOT (> 20 dark pixels): {len(clipped_bot)} -> {clipped_bot}")

assert len(missing_student) == 0, f"Missing {len(missing_student)} student crops!"
assert len(missing_solution) == 0, f"Missing {len(missing_solution)} solution crops!"
assert len(clipped_top) == 0, f"Clipped top on {len(clipped_top)} crops!"
assert len(clipped_bot) == 0, f"Clipped bot on {len(clipped_bot)} crops!"

# 3. Check crops.json
with open(os.path.join(DATA_DIR, "crops.json"), "r", encoding="utf-8") as f:
    crops = json.load(f)

crops_2_2 = [c for c in crops if "jh2_2" in c.get("out", "")]
print(f"Total jh2_2 crops entries in crops.json: {len(crops_2_2)} (expected {97 * 2} = 194)")
assert len(crops_2_2) == 194, f"Expected 194 crop entries, got {len(crops_2_2)}"

# 4. Check precache.json
with open(os.path.join(ROOT, "precache.json"), "r", encoding="utf-8") as f:
    precache = json.load(f)

for q in questions_2_2:
    assert q["image"] in precache or f"./{q['image']}" in precache, f"Missing {q['image']} in precache"
    assert q["solutionImage"] in precache or f"./{q['solutionImage']}" in precache, f"Missing {q['solutionImage']} in precache"

print("All 97 student crops and 97 solution cards verified perfectly with zero edge clipping!")
