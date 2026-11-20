# -*- coding: utf-8 -*-
"""
Main Execution Script for Junior High Math 2-2 (最大公因數與最小公倍數, pp. 88-105)
Runs full generation of:
- 97 student cropped questions (calibrated pixel coordinates, zero edge clipping)
- 97 teacher solution crops / high-res cards with:
    ★【國中其他解法／另解與速解技巧】
    ★【高中／大學進階觀點與速解】
- Updates data/questions.json (adds zone jh2_2 and questions["jh2_2"])
- Updates data/crops.json
- Updates precache.json
"""
import os
import sys
import json
from PIL import Image
from generate_jh2_2_base import (
    ROOT, SCRATCH, WEB, CROPS_DIR,
    make_full_solution_card, append_advanced_card,
    get_q_img, get_a_img
)
from jh2_2_data_sec1 import SEC1_QUESTIONS
from jh2_2_data_sec2 import SEC2_QUESTIONS
from jh2_2_data_sec3456 import SEC3456_QUESTIONS

sys.stdout.reconfigure(encoding='utf-8')

PAGE_W = 1236.0
PAGE_H = 1735.0

all_definitions = SEC1_QUESTIONS + SEC2_QUESTIONS + SEC3456_QUESTIONS
print(f"Total questions to process for 2-2: {len(all_definitions)}")

questions_2_2 = []
crops_entries = []

for idx, q in enumerate(all_definitions):
    qid = q["id"]
    page = q["page"]
    slug = q["slug"]
    label = q["label"]
    sbox = q["student_box"]
    tbox = q["teacher_box"]
    ans = q["answer"]
    
    # 1. Student crop
    q_img = get_q_img(page)
    s_crop = q_img.crop(sbox)
    s_dest = os.path.join(CROPS_DIR, f"jh2_2-p{page}-{slug}.jpg")
    s_crop.save(s_dest, quality=92)
    
    # Normalized coords for crops.json
    s_norm = [
        round(sbox[0] / PAGE_W, 4),
        round(sbox[1] / PAGE_H, 4),
        round(sbox[2] / PAGE_W, 4),
        round(sbox[3] / PAGE_H, 4)
    ]
    crops_entries.append({
        "source": "1上國中講義數學測驗卷.pdf",
        "page": page,
        "box": s_norm,
        "out": f"crops/jh2_2-p{page}-{slug}.jpg"
    })
    
    # 2. Teacher / Solution crop
    sol_dest = os.path.join(CROPS_DIR, f"jh2_2-p{page}-{slug}_sol.jpg")
    if q.get("sol_custom", False):
        make_full_solution_card(
            label=label,
            answer=ans,
            steps=q.get("steps", []),
            other_jh_steps=q.get("other_jh_steps", []),
            advanced_steps=q.get("advanced_steps", []),
            dest_path=sol_dest
        )
        crops_entries.append({
            "source": "1上國中講義數學測驗卷.pdf",
            "page": page,
            "box": s_norm,
            "out": f"crops/jh2_2-p{page}-{slug}_sol.jpg"
        })
    else:
        a_img = get_a_img(page)
        t_crop = a_img.crop(tbox)
        append_advanced_card(
            crop_img=t_crop,
            other_jh_steps=q.get("other_jh_steps", []),
            advanced_steps=q.get("advanced_steps", []),
            dest_path=sol_dest
        )
        t_norm = [
            round(tbox[0] / PAGE_W, 4),
            round(tbox[1] / PAGE_H, 4),
            round(tbox[2] / PAGE_W, 4),
            round(tbox[3] / PAGE_H, 4)
        ]
        crops_entries.append({
            "source": "1上國中講義數學測驗卷解答.pdf",
            "page": page,
            "box": t_norm,
            "out": f"crops/jh2_2-p{page}-{slug}_sol.jpg"
        })
        
    # Determine question type
    if any(opt in ans for opt in ["(A)", "(B)", "(C)", "(D)"]):
        qtype = "choice"
    elif "非選" in label or "資優" in label:
        qtype = "open"
    else:
        qtype = "fill"
        
    raw_label = label.replace("2-2 ", "")
    legacy_qid = f"jh2_2-p{page}-{raw_label}"
    
    q_dict = {
        "id": legacy_qid,
        "zone": "jh2_2",
        "asset": "1上國中講義數學測驗卷.pdf",
        "page": page,
        "kind": qtype,
        "type": qtype,
        "label": raw_label,
        "top": s_norm[1],
        "bottom": s_norm[3],
        "left": s_norm[0],
        "right": s_norm[2],
        "answer": ans,
        "image": f"crops/jh2_2-p{page}-{slug}.jpg",
        "solutionImage": f"crops/jh2_2-p{page}-{slug}_sol.jpg",
        "studentCrop": f"crops/jh2_2-p{page}-{slug}.jpg",
        "solutionCrop": f"crops/jh2_2-p{page}-{slug}_sol.jpg"
    }
    if q.get("body"):
        q_dict["body"] = q["body"]
        
    questions_2_2.append(q_dict)
    
    if (idx + 1) % 15 == 0 or (idx + 1) == len(all_definitions):
        print(f"Processed {idx + 1} / {len(all_definitions)} questions...")

print(f"Finished generating all {len(questions_2_2)} questions and crops!")

# 3. Update data/questions.json
q_json_path = os.path.join(WEB, "data", "questions.json")
with open(q_json_path, "r", encoding="utf-8") as f:
    db = json.load(f)

zone_def = {
    "id": "jh2_2",
    "category": "國中數學",
    "chapter": "2-2",
    "title": "2-2 最大公因數與最小公倍數",
    "name": "2-2 最大公因數與最小公倍數",
    "pages": "第 88–105 頁（重點範例・基礎・精熟・會考・資優）",
    "description": "國中數學一上｜重點範例演練、基礎題、精熟題、經典會考與資優挑戰（附完整詳解、國中速解技巧與進階觀點）",
    "asset": "1上國中講義數學測驗卷.pdf",
    "questionCount": len(questions_2_2)
}

existing_zones = db.get("zones", [])
filtered_zones = [z for z in existing_zones if z.get("id") != "jh2_2"]

# Insert jh2_2 before jh2_3 or after jh2_1
idx_to_insert = -1
for i, z in enumerate(filtered_zones):
    if z.get("id") == "jh2_3":
        idx_to_insert = i
        break
    elif z.get("id") == "jh2_1":
        idx_to_insert = i + 1

if idx_to_insert != -1:
    filtered_zones.insert(idx_to_insert, zone_def)
else:
    filtered_zones.append(zone_def)

db["zones"] = filtered_zones
db["questions"]["jh2_2"] = questions_2_2

with open(q_json_path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print("Updated data/questions.json successfully!")

# 4. Update data/crops.json
crops_json_path = os.path.join(WEB, "data", "crops.json")
existing_crops = []
if os.path.exists(crops_json_path):
    with open(crops_json_path, "r", encoding="utf-8") as f:
        existing_crops = json.load(f)

filtered_crops = [c for c in existing_crops if "jh2_2" not in c.get("out", "")]
filtered_crops.extend(crops_entries)

with open(crops_json_path, "w", encoding="utf-8") as f:
    json.dump(filtered_crops, f, ensure_ascii=False, indent=2)
print("Updated data/crops.json successfully!")

# 5. Update precache.json
precache_path = os.path.join(WEB, "precache.json")
precache_list = []
if os.path.exists(precache_path):
    with open(precache_path, "r", encoding="utf-8") as f:
        precache_list = json.load(f)

precache_set = set(precache_list)
for c in crops_entries:
    precache_set.add(c["out"])
    precache_set.add(f"./{c['out']}")

with open(precache_path, "w", encoding="utf-8") as f:
    json.dump(sorted(list(precache_set)), f, ensure_ascii=False, indent=2)
print("Updated precache.json successfully!")
