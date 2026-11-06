# -*- coding: utf-8 -*-
"""
Base helper module for Junior High Math 2-3 (分數的四則運算)
Contains card rendering engines supporting both Junior High Alternative Methods
and High School / College Advanced Perspectives.
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.path.join(ROOT, "scratch")
WEB = os.path.join(ROOT, "web")
CROPS_DIR = os.path.join(WEB, "crops")
os.makedirs(CROPS_DIR, exist_ok=True)

FONT_PATH = r"C:\Windows\Fonts\msjh.ttc"
FONT_BOLD = r"C:\Windows\Fonts\msjhbd.ttc"

def clean_math_text(s):
    replacements = {
        '≤': '<=',
        '≥': '>=',
        '≠': '!=',
        '∉': '不屬於',
        '∈': '屬於',
        '∤': '不整除',
        '≢': '不同餘於',
        '⊆': '包含於',
        '↦': ' => ',
        '⇒': ' => ',
        '⇔': ' <=> ',
        '∩': '交集',
        '∪': '聯集',
        '≈': '約為',
        '±': '+/-',
        'π': 'pi',
        'Σ': '總和',
        '¹': '^1',
        '²': '^2',
        '³': '^3',
        '⁴': '^4',
        '⁵': '^5',
        '⁶': '^6',
        '⁷': '^7',
        '⁻': '^-',
        '⁺': '^+',
        '₁': '_1',
        '₂': '_2',
        '₃': '_3',
        '₄': '_4',
        '₅': '_5',
        '₆': '_6',
        '₉': '_9',
        '⌊': '[',
        '⌋': ']',
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s

def wrap_text(text, max_w, font, draw):
    text = clean_math_text(text)
    lines = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        cur = ""
        for ch in paragraph:
            test = cur + ch
            if draw.textlength(test, font=font) <= max_w:
                cur = test
            else:
                lines.append(cur)
                cur = ch
        if cur:
            lines.append(cur)
    return lines

def make_full_solution_card(label, answer, steps, other_jh_steps=None, advanced_steps=None, dest_path="card.jpg", card_w=1080):
    font_title = ImageFont.truetype(FONT_BOLD, 26)
    font_sub = ImageFont.truetype(FONT_BOLD, 22)
    font_text = ImageFont.truetype(FONT_PATH, 20)
    
    line_h = 32
    h = 80
    if answer:
        h += 60
    
    dummy_im = Image.new("RGB", (100, 100))
    dummy_draw = ImageDraw.Draw(dummy_im)
    
    wrapped_steps = []
    for s in steps:
        wrapped_steps.extend(wrap_text(s, card_w - 70, font_text, dummy_draw))
    h += 40 + len(wrapped_steps) * line_h + 20
    
    wrapped_other = []
    if other_jh_steps:
        for s in other_jh_steps:
            wrapped_other.extend(wrap_text(s, card_w - 90, font_text, dummy_draw))
        h += 48 + len(wrapped_other) * line_h + 25
        
    wrapped_adv = []
    if advanced_steps:
        for a in advanced_steps:
            wrapped_adv.extend(wrap_text(a, card_w - 90, font_text, dummy_draw))
        h += 48 + len(wrapped_adv) * line_h + 25
    h += 25
    
    im = Image.new("RGB", (card_w, h), (255, 255, 255))
    draw = ImageDraw.Draw(im)
    
    # Outer frame
    draw.rounded_rectangle([8, 8, card_w - 8, h - 8], radius=14, outline="#1b4f72", width=3)
    # Header bar
    draw.rounded_rectangle([12, 12, card_w - 12, 68], radius=10, fill="#eaf2f8")
    draw.text((25, 22), f"2-3 分數的四則運算｜{label} 詳細解答", fill="#1b4f72", font=font_title)
    
    y = 80
    if answer:
        ans_str = f"標準答案：{answer}"
        box_w = max(320, 50 + int(dummy_draw.textlength(ans_str, font=font_sub)))
        draw.rounded_rectangle([25, y, min(card_w - 25, box_w), y + 46], radius=8, fill="#1e7a46")
        draw.text((38, y + 8), ans_str, fill="#ffffff", font=font_sub)
        y += 62
        
    draw.text((25, y), "【國中標準解法與步驟】", fill="#b03a2e", font=font_sub)
    y += 36
    for line in wrapped_steps:
        draw.text((38, y), line, fill="#212121", font=font_text)
        y += line_h
        
    if wrapped_other:
        y += 15
        other_card_h = 45 + len(wrapped_other) * line_h + 15
        draw.rounded_rectangle([20, y, card_w - 20, y + other_card_h], radius=10, fill="#eafaf1", outline="#1e7a46", width=2)
        draw.text((35, y + 10), "★【國中其他解法／另解與速解技巧】", fill="#145a32", font=font_sub)
        curr_y = y + 46
        for line in wrapped_other:
            draw.text((45, curr_y), line, fill="#194d33", font=font_text)
            curr_y += line_h
        y += other_card_h
        
    if wrapped_adv:
        y += 15
        adv_h = 45 + len(wrapped_adv) * line_h + 15
        draw.rounded_rectangle([20, y, card_w - 20, y + adv_h], radius=10, fill="#f4ecf7", outline="#6c3483", width=2)
        draw.text((35, y + 10), "★【高中／大學進階觀點與速解】", fill="#512e5f", font=font_sub)
        curr_y = y + 46
        for line in wrapped_adv:
            draw.text((45, curr_y), line, fill="#2c3e50", font=font_text)
            curr_y += line_h
            
    im.save(dest_path, quality=92)

def append_advanced_card(crop_img, other_jh_steps, advanced_steps, dest_path):
    if not other_jh_steps and not advanced_steps:
        crop_img.save(dest_path, quality=90)
        return
        
    font_bold = ImageFont.truetype(FONT_BOLD, 18)
    font_text = ImageFont.truetype(FONT_PATH, 16)
    line_h = 26
    
    cw, ch = crop_img.size
    card_w = max(cw, 800)
    
    dummy_im = Image.new("RGB", (100, 100))
    dummy_draw = ImageDraw.Draw(dummy_im)
    
    wrapped_other = []
    if other_jh_steps:
        for s in other_jh_steps:
            wrapped_other.extend(wrap_text(s, card_w - 70, font_text, dummy_draw))
    other_h = (44 + len(wrapped_other) * line_h + 16) if wrapped_other else 0
    
    wrapped_adv = []
    if advanced_steps:
        for a in advanced_steps:
            wrapped_adv.extend(wrap_text(a, card_w - 70, font_text, dummy_draw))
    adv_h = (44 + len(wrapped_adv) * line_h + 16) if wrapped_adv else 0
    
    extra_gap = 12 if (other_h > 0 and adv_h > 0) else 0
    total_extra_h = other_h + adv_h + extra_gap + 16
    
    final_im = Image.new("RGB", (card_w, ch + total_extra_h), (255, 255, 255))
    final_im.paste(crop_img, ((card_w - cw) // 2, 0))
    draw = ImageDraw.Draw(final_im)
    
    curr_y = ch + 8
    if other_h > 0:
        draw.rounded_rectangle([6, curr_y, card_w - 6, curr_y + other_h], radius=8, fill="#eafaf1", outline="#1e7a46", width=2)
        draw.text((18, curr_y + 10), "★【國中其他解法／另解與速解技巧】", fill="#145a32", font=font_bold)
        ty = curr_y + 40
        for l in wrapped_other:
            draw.text((24, ty), l, fill="#194d33", font=font_text)
            ty += line_h
        curr_y += other_h + extra_gap
        
    if adv_h > 0:
        draw.rounded_rectangle([6, curr_y, card_w - 6, curr_y + adv_h], radius=8, fill="#f4ecf7", outline="#6c3483", width=2)
        draw.text((18, curr_y + 10), "★【高中／大學進階觀點與速解】", fill="#512e5f", font=font_bold)
        ty = curr_y + 40
        for l in wrapped_adv:
            draw.text((24, ty), l, fill="#2c3e50", font=font_text)
            ty += line_h
            
    final_im.save(dest_path, quality=90)

q_imgs = {}
a_imgs = {}
def get_q_img(p):
    if p not in q_imgs:
        q_imgs[p] = Image.open(os.path.join(SCRATCH, f"q_p{p}_fixed.jpg"))
    return q_imgs[p]

def get_a_img(p):
    if p not in a_imgs:
        a_imgs[p] = Image.open(os.path.join(SCRATCH, f"a_p{p}_fixed.jpg"))
    return a_imgs[p]

questions_2_3 = []
crops_entries = []

def add_q(page, kind, label, top, bottom, left, right, body, answer,
          steps=None, other_jh_steps=None, advanced_steps=None, sol_custom=False):
    slug = label.replace(" ", "_").replace("（", "_").replace("）", "_").replace("、", "_").replace("／", "_")
    qid = f"jh2_3-p{page}-{label}"
    q_img_rel = f"crops/jh2_3-p{page}-{slug}.jpg"
    a_img_rel = f"crops/jh2_3-p{page}-{slug}_sol.jpg"
    
    q_dest = os.path.join(WEB, q_img_rel.replace('/', os.sep))
    a_dest = os.path.join(WEB, a_img_rel.replace('/', os.sep))
    
    q_full = get_q_img(page)
    a_full = get_a_img(page)
    w, h = q_full.size
    
    box_q = (int(left * w), int(top * h), int(right * w), int(bottom * h))
    q_full.crop(box_q).save(q_dest, quality=88)
    
    if sol_custom and steps:
        make_full_solution_card(label, answer, steps, other_jh_steps, advanced_steps, a_dest)
    else:
        crop_a = a_full.crop(box_q)
        append_advanced_card(crop_a, other_jh_steps, advanced_steps, a_dest)
        
    questions_2_3.append({
        "id": qid,
        "zone": "jh2_3",
        "asset": "1上國中講義數學測驗卷.pdf",
        "page": page,
        "kind": kind,
        "label": label,
        "top": round(top, 4),
        "bottom": round(bottom, 4),
        "left": round(left, 4),
        "right": round(right, 4),
        "body": body,
        "answer": answer,
        "image": q_img_rel,
        "solutionImage": a_img_rel,
    })
    
    crops_entries.append({
        "pdf": "1上國中講義數學測驗卷.pdf",
        "page": page,
        "top": round(top, 4),
        "bottom": round(bottom, 4),
        "left": round(left, 4),
        "right": round(right, 4),
        "out": q_img_rel
    })
    crops_entries.append({
        "pdf": "1上國中講義數學測驗卷解答.pdf",
        "page": page,
        "top": round(top, 4),
        "bottom": round(bottom, 4),
        "left": round(left, 4),
        "right": round(right, 4),
        "out": a_img_rel
    })
