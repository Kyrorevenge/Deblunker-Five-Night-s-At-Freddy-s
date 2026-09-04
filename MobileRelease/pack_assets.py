"""Copy the nights 1-5 + Collections assets into MobileRelease/Assets.

The packed folder is self-contained: host MobileRelease on HTTPS and phones
can use it without this PC running.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Assets"
DST = ROOT / "MobileRelease" / "Assets"

DIRS = [
    "Images/Office",
    "Images/Camera Screens",
    "Images/MainMenu",
    "Images/Gallery",
    "Images/Acheivments",
    "Images/Icons",
    "Images/Animation/Jumpscares",
    "Images/FinalNight/Miscellaneous/Pixelify_Sans",
    "Images/FinalNight/Miscellaneous",
    "Images/Background",
    "Images/CameraStatic",
    "Images/CameraAnimation",
    "Images/Animatronics",
    "Audio/NightCalls",
    "Audio/OfficeScene",
    "Audio/Noise",
]

FILES = [
    "Images/CameraHud.png",
    "Images/CameraHUD.png",
    "Audio/MainMenuStatic.mp3",
    "Audio/OfficeAmbience.mp3",
    "Audio/Door_Close.mp3",
    "Audio/LightButtonPress.mp3",
    "Audio/CameraButtonPress.mp3",
    "Audio/ButtonHover.mp3",
    "Audio/ButtonClick.mp3",
    "Audio/OfficeLightBuzzing.mp3",
    "Audio/Applause.mp3",
    "Audio/Jumpscare.mp3",
    "Audio/FanSound.mp3",
    "Audio/FreddyBoop.mp3",
    "Audio/Acheivment.mp3",
    "Audio/CollectionScreenZoomIn.mp3",
    "Audio/WarningScreenAcceptance.mp3",
    "Videos/GameIntro-Troll.mp4",
]


def _copy_file(rel: str) -> None:
    src = SRC / rel.replace("/", "\\")
    if not src.is_file():
        src = SRC / rel
    if not src.is_file():
        parent = (SRC / Path(rel)).parent
        name = Path(rel).name.lower()
        if parent.is_dir():
            for entry in parent.iterdir():
                if entry.is_file() and entry.name.lower() == name:
                    src = entry
                    break
    if not src.is_file():
        return
    dst = DST / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def _copy_tree(rel: str) -> None:
    src = SRC / rel.replace("/", "\\")
    if not src.is_dir():
        src = SRC / rel
    if not src.is_dir():
        return
    dst = DST / rel
    if dst.exists():
        try:
            shutil.rmtree(dst)
        except OSError as exc:
            print(f"Could not replace {dst}: {exc}; merging instead")
            shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("Old sprites", "*.tmp", "*~"))
            return
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("Old sprites", "*.tmp", "*~"))


def _write_gallery_index() -> None:
    gallery = DST / "Images" / "Gallery"
    items = []
    if gallery.is_dir():
        for path in sorted(gallery.iterdir(), key=lambda p: p.name.lower()):
            if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp"} and path.is_file():
                items.append({"name": path.stem.replace("_", " ").replace("-", " "), "file": path.name})
    out = ROOT / "MobileRelease" / "data" / "gallery.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(items, indent=2), encoding="utf-8")


def _ensure_camera_static() -> None:
    """Write TV-static frames if the PC CameraStatic pack is missing."""
    dest = SRC / "Images" / "CameraStatic" / "Base"
    dest.mkdir(parents=True, exist_ok=True)
    if all((dest / f"Frame ({i}).png").is_file() for i in range(1, 11)):
        return
    try:
        import random
        import pygame

        pygame.init()
        surf = pygame.Surface((320, 180))
        for i in range(1, 11):
            path = dest / f"Frame ({i}).png"
            if path.is_file():
                continue
            px = pygame.PixelArray(surf)
            for y in range(180):
                for x in range(320):
                    v = random.randint(20, 235)
                    px[x, y] = (v, v, v)
            del px
            pygame.image.save(surf, str(path))
    except Exception as exc:
        print(f"Could not generate camera static frames: {exc}")


def _ensure_newspaper() -> None:
    """Newspaper intro art — generate a stand-in if NewsPaper.png is absent."""
    path = SRC / "Images" / "Background" / "NewsPaper.png"
    if path.is_file():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        import pygame

        pygame.init()
        pygame.font.init()
        w, h = 1920, 1080
        surf = pygame.Surface((w, h))
        surf.fill((214, 206, 186))
        pygame.draw.rect(surf, (40, 36, 30), (48, 48, w - 96, h - 96), 4)
        pygame.draw.line(surf, (40, 36, 30), (72, 210), (w - 72, 210), 3)
        font_big = pygame.font.Font(None, 92)
        font_mid = pygame.font.Font(None, 48)
        font_sm = pygame.font.Font(None, 36)
        title = font_big.render("LOCAL PIZZERIA TO REOPEN", True, (28, 24, 20))
        surf.blit(title, title.get_rect(midtop=(w // 2, 88)))
        mast = font_sm.render("HURRICANE  ·  CITY PAPER  ·  EXTRA", True, (70, 64, 52))
        surf.blit(mast, mast.get_rect(midtop=(w // 2, 168)))
        body = [
            "Freddy Fazbear's Pizza will open its doors this week after a brief",
            "renovation. Management asks night staff to remain at their posts",
            "until 6 AM. Doors and lights are provided for your protection.",
            "",
            "A missing persons investigation continues. Parents are advised",
            "to keep children close. Employees: check cameras. Check corners.",
            "Check the doors.",
        ]
        y = 260
        for line in body:
            img = font_mid.render(line, True, (42, 38, 32))
            surf.blit(img, (96, y))
            y += 56
        pygame.image.save(surf, str(path))
    except Exception as exc:
        print(f"Could not generate newspaper: {exc}")


def _ensure_kitchen() -> None:
    dest = SRC / "Images" / "Camera Screens"
    dest.mkdir(parents=True, exist_ok=True)
    empty = dest / "Kitchen.png"
    fred = dest / "Kitchen_Fred.PNG"
    storage = dest / "Storage.PNG"
    storage_fred = dest / "Storage_Fred.PNG"
    if not empty.is_file() and storage.is_file():
        shutil.copy2(storage, empty)
    if not fred.is_file() and storage_fred.is_file():
        shutil.copy2(storage_fred, fred)


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"Missing source Assets: {SRC}")
    DST.mkdir(parents=True, exist_ok=True)
    _ensure_camera_static()
    _ensure_newspaper()
    _ensure_kitchen()
    for rel in DIRS:
        _copy_tree(rel)
    for rel in FILES:
        _copy_file(rel)
    _write_gallery_index()
    print(f"Packed Assets -> {DST}")


if __name__ == "__main__":
    main()
