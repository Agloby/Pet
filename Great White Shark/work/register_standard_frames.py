from pathlib import Path
from PIL import Image
import json, statistics
root=Path('G:/My Drive/Pets/Great White Shark/work')
rows=['idle','running-right','running-left','waving','jumping','failed','waiting','running','review']
report=[]
for state in rows:
    files=sorted((root/'frames'/state).glob('*.png'))
    imgs=[Image.open(p).convert('RGBA') for p in files]
    bounds=[im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox() for im in imgs]
    anchor=bounds[-1][3] if state=='jumping' else bounds[0][3]
    dy=196-anchor
    for p,im,b in zip(files,imgs,bounds):
        if b[1]+dy<3 or b[3]+dy>206: raise RuntimeError(f'Would clip {state}: {b}, shift {dy}')
        out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(im,(0,dy));out.save(p)
    report.append({'state':state,'source_anchor':anchor,'shift_y':dy,'target_baseline':196,'source_baselines':[b[3] for b in bounds]})
(root/'qa/standard-registration.json').write_text(json.dumps({'rows':report},indent=2))
print(json.dumps(report,indent=2))
