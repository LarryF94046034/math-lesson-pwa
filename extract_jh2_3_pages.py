# -*- coding: utf-8 -*-
import os
import sys
import pypdf
from PIL import Image
import io

sys.stdout.reconfigure(encoding='utf-8')

qp = os.path.join('..', 'source-pdf', 'questions.pdf')
ap = os.path.join('..', 'source-pdf', 'answers.pdf')
scratch = os.path.join('..', 'scratch')
os.makedirs(scratch, exist_ok=True)

q_reader = pypdf.PdfReader(qp)
a_reader = pypdf.PdfReader(ap)

for p in range(106, 130):
    pno = p - 1
    # Questions
    q_out = os.path.join(scratch, f"q_p{p}_fixed.jpg")
    if not os.path.exists(q_out):
        page = q_reader.pages[pno]
        for img in page.images:
            if img.name != 'Im0.jpg':
                im = Image.open(io.BytesIO(img.data))
                fixed = im.resize((1236, 1735), Image.Resampling.LANCZOS)
                fixed.save(q_out, quality=95)
                print(f"Saved {q_out}")
                break
    else:
        print(f"Already exists: {q_out}")
        
    # Answers
    a_out = os.path.join(scratch, f"a_p{p}_fixed.jpg")
    if not os.path.exists(a_out):
        page = a_reader.pages[pno]
        for img in page.images:
            if img.name != 'Im0.jpg':
                im = Image.open(io.BytesIO(img.data))
                fixed = im.resize((1236, 1735), Image.Resampling.LANCZOS)
                fixed.save(a_out, quality=95)
                print(f"Saved {a_out}")
                break
    else:
        print(f"Already exists: {a_out}")

print("Extraction of pages 106-129 complete!")
