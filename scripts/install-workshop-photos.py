#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ASSETS = Path(
    "/Users/jeremiewarner/.cursor/projects/Users-jeremiewarner-bankside-mot-website/assets"
)
OUT = Path("/Users/jeremiewarner/bankside-mot-website/public/images")


def find(prefix: str) -> Path:
    matches = sorted(ASSETS.glob(f"{prefix}-*.jpg"))
    if not matches:
        raise FileNotFoundError(prefix)
    return matches[0]


def blur_box(im: Image.Image, box: tuple[int, int, int, int], radius: int = 14) -> None:
    left, top, right, bottom = box
    left = max(0, left)
    top = max(0, top)
    right = min(im.width, right)
    bottom = min(im.height, bottom)
    if right - left < 4 or bottom - top < 4:
        return
    region = im.crop((left, top, right, bottom)).filter(ImageFilter.GaussianBlur(radius=radius))
    im.paste(region, (left, top))


def save(im: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    im.convert("RGB").save(path, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"wrote {path} ({im.width}x{im.height})")


def load(prefix: str) -> Image.Image:
    return Image.open(find(prefix)).convert("RGB")


OUT.mkdir(parents=True, exist_ok=True)

hero = load("IMG_9128")
blur_box(hero, (520, 475, 645, 528), radius=22)
save(hero, "hero-workshop.jpg")

save(load("IMG_9155"), "about-workshop.jpg")

mot = load("IMG_9158")
blur_box(mot, (500, 430, 700, 640), radius=18)  # job sheet / VRM on clipboard
save(mot, "service-mot.jpg")

class7 = load("IMG_9100")
blur_box(class7, (670, 418, 805, 478), radius=18)
save(class7, "service-class7.jpg")

save(load("IMG_9113"), "service-servicing.jpg")
save(load("IMG_9109"), "service-diagnostics.jpg")
save(load("IMG_9116"), "service-alignment.jpg")

save(load("IMG_9157"), "team-band.jpg")

save(load("IMG_9154"), "waiting-lounge.jpg")

# Batch 2 — unique slots (do not reuse the old brake still twice)
save(load("IMG_9138"), "workshop-repairs.jpg")
save(load("IMG_9136"), "service-major.jpg")
save(load("IMG_9145"), "brake-before.jpg")
save(load("IMG_9159"), "brake-after.jpg")

aircon = load("IMG_9163")
blur_box(aircon, (475, 508, 665, 590), radius=18)  # Hyundai SC14 JWP
save(aircon, "service-aircon.jpg")

exterior = load("IMG_9130")
blur_box(exterior, (300, 512, 380, 545), radius=18)  # grey van G8 VNN
blur_box(exterior, (868, 545, 990, 608), radius=18)  # blue hatchback rear plate
blur_box(exterior, (88, 508, 158, 542), radius=16)  # black Mercedes front plate
save(exterior, "exterior.jpg")

for leftover in OUT.glob("_*.jpg"):
    leftover.unlink()
    print(f"removed {leftover.name}")

print("done")
