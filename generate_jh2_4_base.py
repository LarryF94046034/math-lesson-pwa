# -*- coding: utf-8 -*-
"""
Base helper module for Junior High Math 2-4 (指數律)
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
        '∈': '屬於',
        '∉': '不屬於',
        '∣': '整除',
        '∤': '不整除',
        '⊆': '包含於',
        '⇒': ' => ',
        '→': ' => ',
        '⇔': ' <=> ',
        '∩': '交集',
        '∪': '聯集',
        '×': '×',
        '±': '+/-',
        '≈': '約等於',
        '≒': '約等於',
        '≅': '全等於',
        'π': 'pi',
        '∑': '加總',
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
    draw.text((25, 22), f"2-4 指數律｜{label} 詳細解答", fill="#1b4f72", font=font_title)
    
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
            
    wrapped_adv = []
    if advanced_steps:
        for a in advanced_steps:
            wrapped_adv.extend(wrap_text(a, card_w - 70, font_text, dummy_draw))
            
    extra_h = 20
    other_card_h = 0
    if wrapped_other:
        other_card_h = 40 + len(wrapped_other) * line_h + 15
        extra_h += other_card_h + 15
        
    adv_card_h = 0
    if wrapped_adv:
        adv_card_h = 40 + len(wrapped_adv) * line_h + 15
        extra_h += adv_card_h + 15
        
    tot_h = ch + extra_h
    im = Image.new("RGB", (card_w, tot_h), (255, 255, 255))
    draw = ImageDraw.Draw(im)
    
    # Paste base crop
    x_offset = (card_w - cw) // 2
    im.paste(crop_img, (x_offset, 0))
    
    curr_y = ch + 10
    if wrapped_other:
        draw.rounded_rectangle([15, curr_y, card_w - 15, curr_y + other_card_h], radius=10, fill="#eafaf1", outline="#1e7a46", width=2)
        draw.text((28, curr_y + 8), "★【國中其他解法／另解與速解技巧】", fill="#145a32", font=font_bold)
        txt_y = curr_y + 36
        for line in wrapped_other:
            draw.text((38, txt_y), line, fill="#194d33", font=font_text)
            txt_y += line_h
        curr_y += other_card_h + 15
        
    if wrapped_adv:
        draw.rounded_rectangle([15, curr_y, card_w - 15, curr_y + adv_card_h], radius=10, fill="#f4ecf7", outline="#6c3483", width=2)
        draw.text((28, curr_y + 8), "★【高中／大學進階觀點與速解】", fill="#512e5f", font=font_bold)
        txt_y = curr_y + 36
        for line in wrapped_adv:
            draw.text((38, txt_y), line, fill="#2c3e50", font=font_text)
            txt_y += line_h
            
    im.save(dest_path, quality=92)
