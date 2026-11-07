# -*- coding: utf-8 -*-
"""
Main Execution Script for Junior High Math:
- jh2_review: 第 2 章 自我評量 (pp. 140-143, 21 questions)
- jh2_life: 第 2 章 生活中的數學素養題 (p. 144, 1 question)
Runs full generation of:
- 22 student cropped questions
- 22 teacher solution crops / high-res cards with:
    ★【國中其他解法／另解與速解技巧】
    ★【高中／大學進階觀點與速解】
- Updates data/questions.json (adds zones jh2_review, jh2_life and their questions)
- Updates data/crops.json
- Updates precache.json
"""
import os
import sys
import json
from PIL import Image
from generate_jh2_4_base import (
    ROOT, SCRATCH, WEB, CROPS_DIR,
    make_full_solution_card, append_advanced_card
)
from jh2_review_data import JH2_REVIEW_QUESTIONS
from jh2_life_data import JH2_LIFE_QUESTIONS

sys.stdout.reconfigure(encoding='utf-8')

PAGE_W = 1236.0
PAGE_H = 1735.0

cached_q_images = {}
cached_a_images = {}

def get_q_img(page):
    if page not in cached_q_images:
        path = os.path.join(SCRATCH, f"q_p{page}_fixed.jpg")
        cached_q_images[page] = Image.open(path)
    return cached_q_images[page]

def get_a_img(page):
    if page not in cached_a_images:
        path = os.path.join(SCRATCH, f"a_p{page}_fixed.jpg")
        cached_a_images[page] = Image.open(path)
    return cached_a_images[page]

def process_question_list(q_list):
    q_entries = []
    crops_list = []
    for q in q_list:
        qid = q["id"]
        page = q["page"]
        sbox = q["student_box"]
        
        # 1. Student crop
        q_img = get_q_img(page)
        s_crop = q_img.crop(sbox)
        s_dest = os.path.join(CROPS_DIR, f"{qid}.jpg")
        s_crop.save(s_dest, quality=92)
        
        s_norm = [
            round(sbox[0] / PAGE_W, 4),
            round(sbox[1] / PAGE_H, 4),
            round(sbox[2] / PAGE_W, 4),
            round(sbox[3] / PAGE_H, 4)
        ]
        crops_list.append({
            "source": "1上國中講義數學測驗卷.pdf",
            "page": page,
            "box": s_norm,
            "out": f"crops/{qid}.jpg"
        })
        
        # 2. Solution crop
        sol_dest = os.path.join(CROPS_DIR, f"{qid}_sol.jpg")
        if q.get("sol_custom", False):
            make_full_solution_card(
                label=q["label"],
                answer=q["answer"],
                steps=q.get("steps", []),
                other_jh_steps=q.get("other_jh_steps", []),
                advanced_steps=q.get("advanced_steps", []),
                dest_path=sol_dest
            )
            crops_list.append({
                "source": "1上國中講義數學測驗卷.pdf",
                "page": page,
                "box": s_norm,
                "out": f"crops/{qid}_sol.jpg"
            })
        else:
            tbox = q["teacher_box"]
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
            crops_list.append({
                "source": "1上國中講義數學測驗卷.pdf",
                "page": page,
                "box": t_norm,
                "out": f"crops/{qid}_sol.jpg"
            })
            
        ans = q["answer"]
        qtype = "choice" if any(opt in ans for opt in ["(A)", "(B)", "(C)", "(D)"]) else "fill"
        
        q_entries.append({
            "id": qid,
            "page": page,
            "label": q["label"],
            "answer": ans,
            "type": qtype,
            "studentCrop": f"crops/{qid}.jpg",
            "solutionCrop": f"crops/{qid}_sol.jpg"
        })
    return q_entries, crops_list

print("Processing jh2_review questions...")
review_entries, review_crops = process_question_list(JH2_REVIEW_QUESTIONS)
print(f"Processed {len(review_entries)} jh2_review questions!")

print("Processing jh2_life questions...")
life_entries, life_crops = process_question_list(JH2_LIFE_QUESTIONS)
print(f"Processed {len(life_entries)} jh2_life questions!")

# Update data/questions.json
q_json_path = os.path.join(WEB, "data", "questions.json")
with open(q_json_path, "r", encoding="utf-8") as f:
    db = json.load(f)

zone_review_def = {
    "id": "jh2_review",
    "category": "國中數學",
    "chapter": "第 2 章 自我評量",
    "title": "第 2 章 自我評量",
    "name": "第 2 章 自我評量",
    "pages": "第 140–143 頁（選擇題・填充題・計算題）",
    "description": "國中數學一上｜第 2 章 自我評量（含選擇題 12 題、填充題 5 題、計算題 4 題，附完整詳解與雙解觀點）",
    "asset": "1上國中講義數學測驗卷.pdf",
    "questionCount": len(review_entries)
}

zone_life_def = {
    "id": "jh2_life",
    "category": "國中數學",
    "chapter": "第 2 章 素養題",
    "title": "第 2 章 生活中的數學素養題",
    "name": "第 2 章 生活中的數學素養題",
    "pages": "第 144 頁（天干與地支）",
    "description": "國中數學一上｜生活中的數學素養題（天干與地支干支紀年，附完整詳解與雙解觀點）",
    "asset": "1上國中講義數學測驗卷.pdf",
    "questionCount": len(life_entries)
}

existing_zones = db.get("zones", [])
filtered_zones = [z for z in existing_zones if z.get("id") not in ["jh2_review", "jh2_life"]]

# Insert jh2_review and jh2_life after jh2_4
idx_to_insert = -1
for i, z in enumerate(filtered_zones):
    if z.get("id") == "jh2_4":
        idx_to_insert = i + 1
        break

if idx_to_insert != -1:
    filtered_zones.insert(idx_to_insert, zone_review_def)
    filtered_zones.insert(idx_to_insert + 1, zone_life_def)
else:
    filtered_zones.append(zone_review_def)
    filtered_zones.append(zone_life_def)

db["zones"] = filtered_zones
db["questions"]["jh2_review"] = review_entries
db["questions"]["jh2_life"] = life_entries

with open(q_json_path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print("Updated data/questions.json successfully!")

# Update data/crops.json
crops_json_path = os.path.join(WEB, "data", "crops.json")
existing_crops = []
if os.path.exists(crops_json_path):
    with open(crops_json_path, "r", encoding="utf-8") as f:
        existing_crops = json.load(f)

all_new_crops = review_crops + life_crops
filtered_crops = [c for c in existing_crops if "jh2_review" not in c.get("out", "") and "jh2_life" not in c.get("out", "")]
filtered_crops.extend(all_new_crops)

with open(crops_json_path, "w", encoding="utf-8") as f:
    json.dump(filtered_crops, f, ensure_ascii=False, indent=2)
print("Updated data/crops.json successfully!")

# Update precache.json
precache_path = os.path.join(WEB, "precache.json")
precache_list = []
if os.path.exists(precache_path):
    with open(precache_path, "r", encoding="utf-8") as f:
        precache_list = json.load(f)

precache_set = set(precache_list)
for c in all_new_crops:
    precache_set.add(c["out"])

final_precache = sorted(list(precache_set))
with open(precache_path, "w", encoding="utf-8") as f:
    json.dump(final_precache, f, ensure_ascii=False, indent=2)
print("Updated precache.json successfully!")

print("ALL GENERATION TASKS FOR JH2_REVIEW & JH2_LIFE COMPLETED SUCCESSFULLY!")
