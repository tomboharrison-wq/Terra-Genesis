"""Draw the Terra Genesis app icon (1024 px) and pack it as a macOS .icns (PNG-encoded sizes)."""
import io, struct, sys
from PIL import Image, ImageDraw, ImageFilter

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# Rounded-square tile (macOS icon grid: ~824 px body with a margin)
m, r = 100, 185
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m, S - m], r, fill=255)
art = Image.new('RGBA', (S, S))
a = ImageDraw.Draw(art)
for y in range(S):  # sky gradient
    t = y / S
    a.line([(0, y), (S, y)], fill=(int(120 + 80 * t), int(180 + 50 * t), int(230 + 15 * t), 255))
a.ellipse([620, 210, 800, 390], fill=(255, 230, 39, 255))  # Scouts yellow sun
a.polygon([(100, 700), (330, 330), (470, 520), (600, 380), (930, 720), (930, 930), (100, 930)], fill=(32, 91, 65, 255))  # Scouts forest mountains
a.polygon([(330, 330), (395, 435), (350, 420), (300, 450), (270, 425)], fill=(245, 248, 250, 255))  # snow cap
a.polygon([(600, 380), (660, 450), (615, 445), (575, 470), (550, 440)], fill=(245, 248, 250, 255))
a.polygon([(100, 760), (360, 640), (560, 700), (760, 650), (930, 690), (930, 930), (100, 930)], fill=(37, 183, 85, 255))  # Scouts green hills
a.polygon([(100, 840), (930, 800), (930, 930), (100, 930)], fill=(0, 110, 224, 255))  # Scouts blue sea
river = [(420, 700), (470, 740), (430, 780), (500, 820)]
a.line(river, fill=(0, 110, 224, 255), width=26, joint='curve')
img.paste(art, (0, 0), mask)
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([m, m + 14, S - m, S - m + 14], r, fill=(0, 0, 0, 90))
shadow = shadow.filter(ImageFilter.GaussianBlur(18))
icon = Image.alpha_composite(shadow, img)
out = sys.argv[1]
icon.save(out + '.png')
chunks = []
for code, size in [(b'ic10', 1024), (b'ic09', 512), (b'ic14', 512), (b'ic08', 256), (b'ic13', 256), (b'ic07', 128), (b'ic12', 64), (b'ic11', 32)]:
    buf = io.BytesIO()
    icon.resize((size, size), Image.LANCZOS).save(buf, 'PNG')
    data = buf.getvalue()
    chunks.append(code + struct.pack('>I', len(data) + 8) + data)
body = b''.join(chunks)
open(out + '.icns', 'wb').write(b'icns' + struct.pack('>I', len(body) + 8) + body)
print('icon written', out + '.icns')
