# -*- coding: utf-8 -*-
"""
Main Execution Script for Junior High Math 2-3 (分數的四則運算)
Runs full generation of:
- 119 student cropped questions
- 119 teacher solution crops / high-res cards with junior high alternative methods + advanced perspectives
- Updates data/questions.json
- Updates data/crops.json
- Updates precache.json
"""
import os
import sys
import json
from generate_jh2_3_base import questions_2_3, crops_entries, WEB
from jh2_3_data_sec1 import populate_section_1
from jh2_3_data_sec2 import populate_section_2
from jh2_3_data_sec3 import populate_section_3
from jh2_3_data_sec4_5_6 import populate_section_4_5_6

sys.stdout.reconfigure(encoding='utf-8')

print("Starting generation for Junior High 2-3...")

# 1. Populate all sections
print("Populating Section 1 (pp. 106-117)...")
populate_section_1()
print(f"Section 1 done, total questions so far: {len(questions_2_3)}")

print("Populating Section 2 (pp. 118-121)...")
populate_section_2()
print(f"Section 2 done, total questions so far: {len(questions_2_3)}")

print("Populating Section 3 (pp. 122-125)...")
populate_section_3()
print(f"Section 3 done, total questions so far: {len(questions_2_3)}")

print("Populating Sections 4, 5, 6 (pp. 126-129)...")
populate_section_4_5_6()
print(f"All sections done! Total questions: {len(questions_2_3)}")
print(f"Total crop entries to register: {len(crops_entries)}")

# 2. Update data/questions.json
q_json_path = os.path.join(WEB, "data", "questions.json")
with open(q_json_path, "r", encoding="utf-8") as f:
    db = json.load(f)

# Update or insert zone definition
zone_def = {
    "id": "jh2_3",
    "category": "國中數學",
    "chapter": "2-3",
    "title": "2-3 分數的四則運算",
    "name": "2-3 分數的四則運算",
    "pages": "第 106–129 頁（重點範例・基礎・精熟・會考・資優）",
    "description": "國中數學一上｜重點範例演練、基礎題、精熟題、經典會考與資優挑戰（附完整詳解、國中速解技巧與進階觀點）",
    "asset": "1上國中講義數學測驗卷.pdf",
    "questionCount": len(questions_2_3)
}

# Keep zones list ordered: jh1_1, jh2_1, jh2_2, jh2_3, then others
existing_zones = db.get("zones", [])
filtered_zones = [z for z in existing_zones if z.get("id") != "jh2_3"]

# Insert jh2_3 after jh2_2 if present, else prepend
idx_to_insert = -1
for i, z in enumerate(filtered_zones):
    if z.get("id") == "jh2_2":
        idx_to_insert = i + 1
        break

if idx_to_insert != -1:
    filtered_zones.insert(idx_to_insert, zone_def)
else:
    filtered_zones.append(zone_def)

db["zones"] = filtered_zones
db["questions"]["jh2_3"] = questions_2_3

with open(q_json_path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print("Updated data/questions.json successfully!")

# 3. Update data/crops.json
crops_json_path = os.path.join(WEB, "data", "crops.json")
existing_crops = []
if os.path.exists(crops_json_path):
    with open(crops_json_path, "r", encoding="utf-8") as f:
        existing_crops = json.load(f)

# Remove any previous jh2_3 crops
filtered_crops = [c for c in existing_crops if "jh2_3" not in c.get("out", "")]
filtered_crops.extend(crops_entries)

with open(crops_json_path, "w", encoding="utf-8") as f:
    json.dump(filtered_crops, f, ensure_ascii=False, indent=2)
print("Updated data/crops.json successfully!")

# 4. Update precache.json
precache_path = os.path.join(WEB, "precache.json")
precache_list = []
if os.path.exists(precache_path):
    with open(precache_path, "r", encoding="utf-8") as f:
        precache_list = json.load(f)

precache_set = set(precache_list)
# Add all new crop paths
for c in crops_entries:
    out_rel = c["out"]
    precache_set.add(out_rel)

final_precache = sorted(list(precache_set))
with open(precache_path, "w", encoding="utf-8") as f:
    json.dump(final_precache, f, ensure_ascii=False, indent=2)
print("Updated precache.json successfully!")

print("ALL GENERATION TASKS COMPLETED SUCCESSFULLY!")
