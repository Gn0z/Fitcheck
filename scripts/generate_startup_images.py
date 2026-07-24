from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRECTORY = ROOT / "assets" / "startup"
SF_FONT = Path("/System/Library/Fonts/SFNS.ttf")
PINGFANG_FONT = Path("/System/Library/Fonts/PingFang.ttc")

TARGETS = (
    (320, 568, 2),
    (375, 667, 2),
    (414, 736, 3),
    (375, 812, 3),
    (414, 896, 2),
    (414, 896, 3),
    (390, 844, 3),
    (428, 926, 3),
    (393, 852, 3),
    (430, 932, 3),
    (402, 874, 3),
    (420, 912, 3),
    (440, 956, 3),
)


def scaled(value, scale):
    return round(value * scale)


def centered_text(draw, position, text, font, fill):
    draw.text(position, text, font=font, fill=fill, anchor="ma")


def draw_startup_image(logical_width, logical_height, scale):
    width = logical_width * scale
    height = logical_height * scale
    image = Image.new("RGB", (width, height), "#f3f4f6")

    highlight = Image.new("RGBA", image.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    radius = scaled(max(logical_width * 0.52, 190), scale)
    center_x = scaled(logical_width * 0.82, scale)
    center_y = scaled(logical_height * 0.07, scale)
    highlight_draw.ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        fill=(255, 255, 255, 210),
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(scaled(72, scale)))
    image = Image.alpha_composite(image.convert("RGBA"), highlight)

    decoration = Image.new("RGBA", image.size, (0, 0, 0, 0))
    decoration_draw = ImageDraw.Draw(decoration)
    circle_size = scaled(164, scale)
    circle_left = width - scaled(40, scale) - circle_size
    circle_top = -scaled(42, scale)
    decoration_draw.ellipse(
        (
            circle_left,
            circle_top,
            circle_left + circle_size,
            circle_top + circle_size,
        ),
        outline=(17, 24, 39, 10),
        width=max(1, scale),
    )
    spread = scaled(44, scale)
    decoration_draw.ellipse(
        (
            circle_left - spread,
            circle_top - spread,
            circle_left + circle_size + spread,
            circle_top + circle_size + spread,
        ),
        outline=(17, 24, 39, 6),
        width=max(1, scaled(12, scale)),
    )
    image = Image.alpha_composite(image, decoration)

    content_top = scaled(logical_height / 2 - 139, scale)
    icon_size = scaled(96, scale)
    icon_left = (width - icon_size) // 2

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (
            icon_left,
            content_top + scaled(12, scale),
            icon_left + icon_size,
            content_top + icon_size + scaled(12, scale),
        ),
        radius=scaled(26, scale),
        fill=(17, 24, 39, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(scaled(18, scale)))
    image = Image.alpha_composite(image, shadow)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (
            icon_left,
            content_top,
            icon_left + icon_size,
            content_top + icon_size,
        ),
        radius=scaled(22, scale),
        fill="#111827",
    )
    icon_center_x = icon_left + icon_size // 2
    icon_center_y = content_top + icon_size // 2
    icon_circle_radius = scaled(28, scale)
    draw.ellipse(
        (
            icon_center_x - icon_circle_radius,
            icon_center_y - icon_circle_radius,
            icon_center_x + icon_circle_radius,
            icon_center_y + icon_circle_radius,
        ),
        fill="#f3f4f6",
    )

    icon_scale = icon_size / 512
    check_points = [
        (icon_left + round(174 * icon_scale), content_top + round(261 * icon_scale)),
        (icon_left + round(228 * icon_scale), content_top + round(315 * icon_scale)),
        (icon_left + round(340 * icon_scale), content_top + round(195 * icon_scale)),
    ]
    check_width = max(1, round(42 * icon_scale))
    draw.line(check_points, fill="#111827", width=check_width, joint="curve")
    endpoint_radius = check_width // 2
    for x, y in (check_points[0], check_points[-1]):
        draw.ellipse(
            (
                x - endpoint_radius,
                y - endpoint_radius,
                x + endpoint_radius,
                y + endpoint_radius,
            ),
            fill="#111827",
        )

    title_font = ImageFont.truetype(str(SF_FONT), scaled(36, scale))
    title_font.set_variation_by_name("Black")
    tagline_font = ImageFont.truetype(str(PINGFANG_FONT), scaled(14, scale))
    title_top = content_top + icon_size + scaled(28, scale)
    centered_text(draw, (width // 2, title_top), "FitCheck", title_font, "#111827")
    tagline_top = title_top + scaled(42 + 8, scale)
    centered_text(
        draw,
        (width // 2, tagline_top),
        "让每一次训练都有迹可循",
        tagline_font,
        "#4b5563",
    )

    return image.convert("RGB")


def main():
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for logical_width, logical_height, scale in TARGETS:
        image = draw_startup_image(logical_width, logical_height, scale)
        output_path = OUTPUT_DIRECTORY / f"fitcheck-{image.width}x{image.height}.png"
        image.save(output_path, format="PNG", optimize=True)
        print(output_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
