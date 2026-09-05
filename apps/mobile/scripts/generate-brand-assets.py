"""Generate Expo icon/splash/adaptive assets from brand logos."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[3]
SRC = Path(r"C:\Users\epicn\Downloads\Setlist ultra main logos and animation")
BRAND = REPO / "brand"
IMAGES = REPO / "apps" / "mobile" / "assets" / "images"
MOBILE_BRAND = REPO / "apps" / "mobile" / "assets" / "brand"

SIZE = 1024


def copy_sources() -> dict[str, Path]:
    BRAND.mkdir(parents=True, exist_ok=True)
    MOBILE_BRAND.mkdir(parents=True, exist_ok=True)
    mapping = {
        "logo-main.png": SRC / "logo main.png",
        "logo-black.png": SRC / "logo black.png",
        "logo-white.png": SRC / "logo white.png",
        "logo-app.png": SRC / "setlist ultra app logo.png",
    }
    out: dict[str, Path] = {}
    for dest_name, src in mapping.items():
        data = src.read_bytes()
        (BRAND / dest_name).write_bytes(data)
        (MOBILE_BRAND / dest_name).write_bytes(data)
        out[dest_name] = BRAND / dest_name
    return out


def flatten_full_bleed(src: Image.Image, zoom: float = 1.16) -> Image.Image:
    """Turn a pre-squirled mark into a square iOS master (system applies the mask)."""
    rgba = src.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    cropped = rgba.crop(bbox)
    scaled = max(SIZE, int(SIZE * zoom))
    fitted = cropped.resize((scaled, scaled), Image.Resampling.LANCZOS)
    left = (scaled - SIZE) // 2
    tile = fitted.crop((left, left, left + SIZE, left + SIZE))
    # Fill leftover transparent pixels from a blurred copy so corners aren't holes.
    rgb = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    filler = tile.convert("RGB").filter(ImageFilter.GaussianBlur(24))
    rgb.paste(filler)
    rgb.paste(tile, mask=tile.split()[-1])
    return rgb


def adaptive_foreground(src: Image.Image) -> Image.Image:
    """Keep ~15% safe zone; source bbox is already inset."""
    rgba = src.convert("RGBA")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(rgba, (0, 0), rgba)
    return canvas


def monochrome_su(src: Image.Image) -> Image.Image:
    rgba = src.convert("RGBA")
    pixels = rgba.load()
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    dest = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = pixels[x, y]
            if a < 180:
                continue
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            if luma < 48:
                dest[x, y] = (255, 255, 255, a)
    return out


def main() -> None:
    paths = copy_sources()
    IMAGES.mkdir(parents=True, exist_ok=True)
    app = Image.open(paths["logo-app.png"])
    wordmark = Image.open(paths["logo-main.png"]).convert("RGBA")

    icon = flatten_full_bleed(app)
    icon.save(IMAGES / "icon.png", "PNG")

    fg = adaptive_foreground(app)
    fg.save(IMAGES / "android-icon-foreground.png", "PNG")

    Image.new("RGB", (SIZE, SIZE), (0, 0, 0)).save(IMAGES / "android-icon-background.png", "PNG")

    mono = monochrome_su(app)
    mono.save(IMAGES / "android-icon-monochrome.png", "PNG")

    # Splash: wordmark, contained by expo-splash-screen on white.
    splash = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    wm = wordmark.copy()
    wm.thumbnail((820, 820), Image.Resampling.LANCZOS)
    splash.paste(wm, ((SIZE - wm.width) // 2, (SIZE - wm.height) // 2), wm)
    splash.save(IMAGES / "splash-icon.png", "PNG")

    icon.resize((48, 48), Image.Resampling.LANCZOS).save(IMAGES / "favicon.png", "PNG")
    print("Wrote brand copies and Expo image assets.")


if __name__ == "__main__":
    main()
