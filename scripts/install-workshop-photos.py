#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(
    "/Users/jeremiewarner/.cursor/projects/Users-jeremiewarner-bankside-mot-website/assets"
)
OUT = Path("/Users/jeremiewarner/bankside-mot-website/public/images")


def find(prefix: str) -> Path:
    matches = sorted(ASSETS.glob(f"{prefix}-*.jpg"))
    if not matches:
        raise FileNotFoundError(prefix)
    return matches[0]


def save(im: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = im.convert("RGB")
    path = OUT / name
    rgb.save(path, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"wrote {path} ({im.width}x{im.height})")
    if name.lower().endswith((".jpg", ".jpeg")):
        webp = path.with_suffix(".webp")
        rgb.save(webp, "WEBP", quality=78, method=6)
        print(f"wrote {webp}")


def load(prefix: str) -> Image.Image:
    return Image.open(find(prefix)).convert("RGB")


OUT.mkdir(parents=True, exist_ok=True)

save(load("IMG_9128"), "hero-workshop.jpg")
save(load("IMG_9155"), "about-workshop.jpg")
save(load("IMG_9158"), "service-mot.jpg")
save(load("IMG_9100"), "service-class7.jpg")
save(load("IMG_9113"), "service-servicing.jpg")
save(load("IMG_9109"), "service-diagnostics.jpg")
save(load("IMG_9116"), "service-alignment.jpg")
save(load("IMG_9157"), "team-band.jpg")
save(load("IMG_9154"), "waiting-lounge.jpg")
save(load("IMG_9138"), "workshop-repairs.jpg")
save(load("IMG_9136"), "service-major.jpg")
save(load("IMG_9145"), "brake-before.jpg")
save(load("IMG_9159"), "brake-after.jpg")
save(load("IMG_9163"), "service-aircon.jpg")
save(load("IMG_9130"), "exterior.jpg")

for leftover in OUT.glob("_*.jpg"):
    leftover.unlink()
    print(f"removed {leftover.name}")

print("done")
