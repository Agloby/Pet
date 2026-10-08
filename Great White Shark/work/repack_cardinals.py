from pathlib import Path
import sys
from PIL import Image
sys.path.insert(0,'C:/Users/amey/.codex/plugins/cache/openai-curated-remote/work-pets/0.1.6/skills/create-pet/scripts')
from extract_strip_frames import remove_chroma_background,extract_component_frames
root=Path('G:/My Drive/Pets/Great White Shark/work')
source=remove_chroma_background(Image.open(root/'decoded/look-cardinals.png'),(255,0,255),96)
frames=extract_component_frames(source,4)
if frames is None:raise RuntimeError('No complete four pose groups')
strip=Image.new('RGBA',(768,208),(255,0,255,255))
for i,frame in enumerate(frames):strip.alpha_composite(frame,(i*192,0))
strip.save(root/'decoded/look-cardinals-repacked.png')
