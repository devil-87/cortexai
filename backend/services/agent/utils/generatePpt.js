import pptxgen from "pptxgenjs";
import zlib from "zlib";

const FONT = "Calibri";
const W = 13.33;
const H = 7.5;

/* ---------- THEMES (gradient based, one per deck) ---------- */
// grad = background gradient stops (dark -> bright), bar = accent strip colors
const PALETTES = {
    aurora:   { primary: "7C3AED", dark: "1E1B4B", accent: "22D3EE", tint: "F5F3FF", soft: "DDD6FE", grad: ["1E1B4B", "4C1D95", "7C3AED"], bar: ["7C3AED", "22D3EE"] },
    ocean:    { primary: "0284C7", dark: "0B1D3A", accent: "2DD4BF", tint: "F0F9FF", soft: "BAE6FD", grad: ["0B1D3A", "0C4A6E", "0E7490"], bar: ["0284C7", "2DD4BF"] },
    sunset:   { primary: "DB2777", dark: "3B0764", accent: "FBBF24", tint: "FDF2F8", soft: "FBCFE8", grad: ["3B0764", "9D174D", "F97316"], bar: ["DB2777", "FBBF24"] },
    emerald:  { primary: "059669", dark: "022C22", accent: "5EEAD4", tint: "ECFDF5", soft: "A7F3D0", grad: ["022C22", "065F46", "0D9488"], bar: ["059669", "5EEAD4"] },
    midnight: { primary: "2563EB", dark: "020617", accent: "FBBF24", tint: "EFF6FF", soft: "BFDBFE", grad: ["020617", "0F172A", "1E3A8A"], bar: ["2563EB", "FBBF24"] },
    berry:    { primary: "E11D48", dark: "2E0A1F", accent: "FDA4AF", tint: "FFF1F2", soft: "FECDD3", grad: ["2E0A1F", "7F1D4A", "E11D48"], bar: ["E11D48", "FDA4AF"] },
};

const N = {
    text: "334155",
    muted: "64748B",
    border: "E2E8F0",
    white: "FFFFFF",
    bg: "F8FAFC",
};

// use data.theme if valid, otherwise pick by title (same topic -> same look)
const pickPalette = (data) => {
    if (data?.theme && PALETTES[data.theme]) return PALETTES[data.theme];
    const keys = Object.keys(PALETTES);
    let hash = 0;
    for (const ch of String(data?.title || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTES[keys[hash % keys.length]];
};

/* ---------- GRADIENTS (pptxgenjs has no gradient fill, so we draw a PNG) ---------- */
const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
};
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));

const gradCache = new Map();
// stops: ["1E1B4B","7C3AED"], angle: CSS style (135 = top-left -> bottom-right, 180 = top -> bottom)
const gradient = (stops, angle = 135, w = 320, h = 180) => {
    const key = [stops.join(), angle, w, h].join("|");
    if (gradCache.has(key)) return gradCache.get(key);

    const rgb = stops.map(hex);
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const norm = Math.abs(dx) + Math.abs(dy) || 1;

    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
        const row = y * (w * 3 + 1);
        raw[row] = 0;
        for (let x = 0; x < w; x++) {
            const u = x / Math.max(w - 1, 1) - 0.5;
            const v = y / Math.max(h - 1, 1) - 0.5;
            const t = Math.min(1, Math.max(0, 0.5 + (u * dx + v * dy) / norm));
            const pos = t * (rgb.length - 1);
            const i = Math.min(Math.floor(pos), rgb.length - 2);
            const f = pos - i;
            for (let c = 0; c < 3; c++) {
                raw[row + 1 + x * 3 + c] = Math.round(rgb[i][c] + (rgb[i + 1][c] - rgb[i][c]) * f);
            }
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // RGB
    const png = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);

    const data = "image/png;base64," + png.toString("base64");
    gradCache.set(key, data);
    return data;
};

const darkBg = (p) => ({ data: gradient(p.grad, 135) });
const lightBg = (p) => ({ data: gradient(["FFFFFF", p.tint], 160) });

/* ---------- HELPERS ---------- */
// pptxgenjs mutates option objects, so always build fresh ones
const txt = (slide, text, o = {}) =>
    slide.addText(String(text ?? ""), {
        isTextBox: true,
        fontFace: FONT,
        margin: 0,
        ...o,
    });

const shadow = () => ({
    type: "outer",
    color: "000000",
    opacity: 0.12,
    blur: 6,
    offset: 2,
    angle: 90,
});

const sizeFor = (s) => {
    const len = String(s).length;
    if (len > 80) return 13;
    if (len > 55) return 14;
    if (len > 35) return 16;
    return 18;
};

const addPhoto = (ppt, slide, p, img, x, y, w, h, frame = true) => {
    if (frame) {
        slide.addShape(ppt.ShapeType.rect, {
            x: x + 0.15, y: y + 0.15, w, h,
            fill: { color: p.primary },
            line: { color: p.primary },
        });
    }
    // img must be a base64 data URI: "image/jpeg;base64,...."
    slide.addImage({ data: img, x, y, w, h, sizing: { type: "cover", w, h } });
};

const num = (i) => String(i + 1).padStart(2, "0");

const header = (ppt, slide, p, title) => {
    slide.addImage({
        data: gradient(p.bar, 180, 16, 64),
        x: 0.7, y: 0.55, w: 0.12, h: 0.65,
    });
    txt(slide, title, {
        x: 1.05, y: 0.5, w: 11.6, h: 0.75,
        fontSize: 28, bold: true, color: p.dark,
        valign: "middle", fit: "shrink",
    });
};

const footer = (slide, page, total, showBrand = true) => {
    if (showBrand) {
        txt(slide, "CortexAI", {
            x: 0.7, y: 6.95, w: 3, h: 0.3,
            fontSize: 10, color: N.muted,
        });
    }
    txt(slide, `${page} / ${total}`, {
        x: 11.6, y: 6.95, w: 1.03, h: 0.3,
        fontSize: 10, color: N.muted, align: "right",
    });
};

/* ---------- COVER ---------- */
const addCover = (ppt, data, p) => {
    const slide = ppt.addSlide();
    slide.background = darkBg(p);

    const hasImage = !!data?.coverImage;

    if (hasImage) {
        // coverImage must be a base64 data URI: "image/jpeg;base64,...."
        slide.addImage({
            data: data.coverImage,
            x: 7.6, y: 0, w: W - 7.6, h: H,
            sizing: { type: "cover", w: W - 7.6, h: H },
        });
        slide.addShape(ppt.ShapeType.rect, {
            x: 7.45, y: 0, w: 0.15, h: H,
            fill: { color: p.primary },
            line: { color: p.primary },
        });
    } else {
        slide.addShape(ppt.ShapeType.ellipse, {
            x: 8.6, y: -1.6, w: 6.4, h: 6.4,
            fill: { color: p.primary, transparency: 35 },
            line: { color: p.primary, transparency: 100 },
        });
        slide.addShape(ppt.ShapeType.ellipse, {
            x: 10.2, y: 3.9, w: 4.6, h: 4.6,
            fill: { color: p.accent, transparency: 60 },
            line: { color: p.accent, transparency: 100 },
        });
        slide.addShape(ppt.ShapeType.ellipse, {
            x: 7.7, y: 5.2, w: 1.6, h: 1.6,
            fill: { color: p.primary, transparency: 55 },
            line: { color: p.primary, transparency: 100 },
        });
    }

    slide.addImage({ data: gradient(p.bar.slice().reverse(), 90, 64, 8), x: 0.9, y: 2.0, w: 1.2, h: 0.1 });

    txt(slide, data?.title || "Presentation", {
        x: 0.9, y: 2.3, w: hasImage ? 6.3 : 8.2, h: 2.0,
        fontSize: 40, bold: true, color: N.white,
        valign: "top", fit: "shrink",
    });

    txt(slide, data?.subtitle || "", {
        x: 0.9, y: 4.45, w: hasImage ? 6.3 : 7.6, h: 1.0,
        fontSize: 18, color: p.soft,
        valign: "top", fit: "shrink",
    });

    txt(slide, "Generated by CortexAI", {
        x: 0.9, y: 6.8, w: 4, h: 0.3,
        fontSize: 11, color: p.accent,
    });
};

/* ---------- AGENDA ---------- */
const addAgenda = (ppt, slides, p, total) => {
    const slide = ppt.addSlide();
    slide.background = lightBg(p);
    header(ppt, slide, p, "Agenda");

    const items = slides.slice(0, 6);
    const colW = 5.85;
    const gap = 0.3;

    items.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.7 + col * (colW + gap);
        const y = 1.8 + row * 1.6;

        txt(slide, num(i), {
            x, y, w: 1.0, h: 1.0,
            fontSize: 36, bold: true, color: p.primary, valign: "middle",
        });
        txt(slide, s?.title || `Section ${i + 1}`, {
            x: x + 1.1, y, w: colW - 1.2, h: 1.0,
            fontSize: 20, color: p.dark, valign: "middle", fit: "shrink",
        });
        slide.addShape(ppt.ShapeType.line, {
            x, y: y + 1.15, w: colW, h: 0,
            line: { color: N.border, width: 1 },
        });
    });

    footer(slide, 2, total);
};

/* ---------- CONTENT LAYOUT 1: CARD GRID ---------- */
const layoutCards = (ppt, slide, p, title, points, img) => {
    slide.background = lightBg(p);
    header(ppt, slide, p, title);

    if (img) {
        // single column of cards on the left, photo on the right
        const list = points.slice(0, 5);
        const pitch = Math.min(1.25, 5.0 / Math.max(list.length, 1));
        const cardH = pitch - 0.2;
        const cardW = 7.0;

        list.forEach((pt, i) => {
            const y = 1.6 + i * pitch;
            slide.addShape(ppt.ShapeType.roundRect, {
                x: 0.7, y, w: cardW, h: cardH,
                fill: { color: N.white },
                line: { color: N.border, width: 1 },
                rectRadius: 0.12,
                shadow: shadow(),
            });
            slide.addShape(ppt.ShapeType.roundRect, {
                x: 0.95, y: y + (cardH - 0.5) / 2, w: 0.5, h: 0.5,
                fill: { color: p.primary },
                line: { color: p.primary },
                rectRadius: 0.12,
            });
            txt(slide, i + 1, {
                x: 0.95, y: y + (cardH - 0.5) / 2, w: 0.5, h: 0.5,
                fontSize: 14, bold: true, color: N.white,
                align: "center", valign: "middle",
            });
            txt(slide, pt, {
                x: 1.7, y: y + 0.08, w: cardW - 1.2, h: cardH - 0.16,
                fontSize: Math.min(sizeFor(pt), 16), color: N.text,
                valign: "middle", fit: "shrink",
            });
        });

        addPhoto(ppt, slide, p, img, 8.1, 1.6, 4.4, 4.9);
        return;
    }

    const rows = Math.ceil(points.length / 2);
    const cardH = rows <= 2 ? 2.2 : 1.5;
    const gap = 0.25;
    const cardW = 5.85;

    points.forEach((pt, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.7 + col * (cardW + gap);
        const y = 1.6 + row * (cardH + gap);

        slide.addShape(ppt.ShapeType.roundRect, {
            x, y, w: cardW, h: cardH,
            fill: { color: N.white },
            line: { color: N.border, width: 1 },
            rectRadius: 0.12,
            shadow: shadow(),
        });

        slide.addShape(ppt.ShapeType.roundRect, {
            x: x + 0.3, y: y + 0.3, w: 0.55, h: 0.55,
            fill: { color: p.primary },
            line: { color: p.primary },
            rectRadius: 0.14,
        });
        txt(slide, i + 1, {
            x: x + 0.3, y: y + 0.3, w: 0.55, h: 0.55,
            fontSize: 16, bold: true, color: N.white,
            align: "center", valign: "middle",
        });

        txt(slide, pt, {
            x: x + 1.1, y: y + 0.2, w: cardW - 1.4, h: cardH - 0.4,
            fontSize: sizeFor(pt), color: N.text, valign: "middle", fit: "shrink",
        });
    });
};

/* ---------- CONTENT LAYOUT 2: COLOR SIDE PANEL + LIST ---------- */
const layoutPanel = (ppt, slide, p, title, points, index, img) => {
    slide.background = lightBg(p);

    slide.addImage({
        data: gradient([p.dark, p.primary], 160, 176, 300),
        x: 0, y: 0, w: 4.4, h: H,
    });
    if (img) {
        addPhoto(ppt, slide, p, img, 0, 4.7, 4.4, 2.8, false);
    } else {
        slide.addShape(ppt.ShapeType.ellipse, {
            x: -1.2, y: 5.2, w: 3.6, h: 3.6,
            fill: { color: p.accent, transparency: 70 },
            line: { color: p.accent, transparency: 100 },
        });
    }

    txt(slide, num(index), {
        x: 0.6, y: 0.9, w: 3.2, h: 1.3,
        fontSize: 66, bold: true, color: p.soft, valign: "middle",
    });
    txt(slide, title, {
        x: 0.6, y: 2.4, w: 3.3, h: img ? 2.0 : 2.4,
        fontSize: img ? 26 : 30, bold: true, color: N.white, valign: "top", fit: "shrink",
    });
    if (!img) {
        txt(slide, "CortexAI", {
            x: 0.6, y: 6.95, w: 2.5, h: 0.3,
            fontSize: 10, color: p.soft,
        });
    }

    const rowH = Math.min(1.1, 5.6 / Math.max(points.length, 1));

    points.forEach((pt, i) => {
        const y = 0.95 + i * rowH;

        slide.addShape(ppt.ShapeType.ellipse, {
            x: 5.0, y: y + (rowH - 0.5) / 2 - 0.05, w: 0.5, h: 0.5,
            fill: { color: p.tint },
            line: { color: p.primary, width: 1.25 },
        });
        txt(slide, i + 1, {
            x: 5.0, y: y + (rowH - 0.5) / 2 - 0.05, w: 0.5, h: 0.5,
            fontSize: 14, bold: true, color: p.primary,
            align: "center", valign: "middle",
        });
        txt(slide, pt, {
            x: 5.8, y, w: 6.9, h: rowH - 0.1,
            fontSize: sizeFor(pt) + 1, color: N.text, valign: "middle", fit: "shrink",
        });
        if (i < points.length - 1) {
            slide.addShape(ppt.ShapeType.line, {
                x: 5.0, y: y + rowH - 0.05, w: 7.6, h: 0,
                line: { color: N.border, width: 1 },
            });
        }
    });
};

/* ---------- CONTENT LAYOUT 3: KEY POINT CALLOUT + LIST ---------- */
const layoutHighlight = (ppt, slide, p, title, points, img) => {
    slide.background = lightBg(p);
    header(ppt, slide, p, title);

    const [first, ...rest] = points;

    slide.addShape(ppt.ShapeType.roundRect, {
        x: 0.7, y: 1.7, w: 4.7, h: 4.9,
        fill: { color: p.dark },
        line: { color: p.dark },
        rectRadius: 0.15,
        shadow: shadow(),
    });
    slide.addShape(ppt.ShapeType.rect, {
        x: 1.1, y: 2.2, w: 0.8, h: 0.08,
        fill: { color: p.accent },
        line: { color: p.accent },
    });
    txt(slide, "KEY POINT", {
        x: 1.1, y: 2.4, w: 3.8, h: 0.35,
        fontSize: 12, bold: true, color: p.accent, charSpacing: 3,
    });
    txt(slide, first, {
        x: 1.1, y: 2.9, w: 3.9, h: img ? 1.3 : 3.2,
        fontSize: img ? (first.length > 50 ? 17 : 21) : (first.length > 60 ? 20 : 26),
        bold: true, color: N.white,
        valign: "top", fit: "shrink",
    });
    if (img) addPhoto(ppt, slide, p, img, 1.1, 4.4, 3.9, 1.9, false);

    const pitch = Math.min(1.1, 4.9 / Math.max(rest.length, 1));

    rest.forEach((pt, i) => {
        const y = 1.7 + i * pitch;

        slide.addShape(ppt.ShapeType.roundRect, {
            x: 5.8, y, w: 6.83, h: pitch - 0.15,
            fill: { color: N.white },
            line: { color: N.border, width: 1 },
            rectRadius: 0.1,
        });
        slide.addShape(ppt.ShapeType.rect, {
            x: 5.8, y: y + 0.12, w: 0.09, h: pitch - 0.39,
            fill: { color: p.primary },
            line: { color: p.primary },
        });
        txt(slide, pt, {
            x: 6.15, y: y + 0.05, w: 6.2, h: pitch - 0.25,
            fontSize: sizeFor(pt), color: N.text, valign: "middle", fit: "shrink",
        });
    });
};

/* ---------- CONTENT SLIDE (cycles layouts) ---------- */
const addContentSlide = (ppt, s, p, index, page, total) => {
    const slide = ppt.addSlide();
    const title = s?.title || `Slide ${index + 1}`;
    const points = (Array.isArray(s?.points) ? s.points : [])
        .map((x) => String(x))
        .filter(Boolean)
        .slice(0, 6);

    const layouts = ["cards", "panel", "highlight"];
    let layout = layouts[index % layouts.length];
    if (layout === "highlight" && points.length < 3) layout = "cards";

    const img = s?.image || null; // optional base64 data URI

    if (layout === "cards") layoutCards(ppt, slide, p, title, points, img);
    else if (layout === "panel") layoutPanel(ppt, slide, p, title, points, index, img);
    else layoutHighlight(ppt, slide, p, title, points, img);

    footer(slide, page, total, layout !== "panel");

    if (s?.notes) slide.addNotes(String(s.notes)); // speaker notes
};

/* ---------- CLOSING ---------- */
const addThankYou = (ppt, data, p) => {
    const slide = ppt.addSlide();
    slide.background = darkBg(p);

    slide.addShape(ppt.ShapeType.ellipse, {
        x: 8.8, y: -1.4, w: 6.0, h: 6.0,
        fill: { color: p.primary, transparency: 40 },
        line: { color: p.primary, transparency: 100 },
    });
    slide.addShape(ppt.ShapeType.ellipse, {
        x: 10.4, y: 4.2, w: 4.2, h: 4.2,
        fill: { color: p.accent, transparency: 65 },
        line: { color: p.accent, transparency: 100 },
    });

    slide.addImage({ data: gradient(p.bar.slice().reverse(), 90, 64, 8), x: 0.9, y: 2.6, w: 1.2, h: 0.1 });
    txt(slide, "Thank You", {
        x: 0.9, y: 2.9, w: 8, h: 1.3,
        fontSize: 54, bold: true, color: N.white, valign: "middle",
    });
    txt(slide, data?.title || "", {
        x: 0.9, y: 4.3, w: 7.5, h: 0.8,
        fontSize: 18, color: p.soft, valign: "top", fit: "shrink",
    });
    if (Array.isArray(data?.credits) && data.credits.length) {
        txt(slide, "Credits: " + data.credits.slice(0, 8).join("  |  "), {
            x: 0.9, y: 5.7, w: 7.6, h: 0.9,
            fontSize: 9, color: p.soft, valign: "top", fit: "shrink",
        });
    }
    txt(slide, "Generated by CortexAI", {
        x: 0.9, y: 6.8, w: 4, h: 0.3,
        fontSize: 11, color: p.accent,
    });
};

/* ---------- MAIN ---------- */
export const generatePpt = async (data) => {
    const ppt = new pptxgen();
    ppt.layout = "LAYOUT_WIDE"; // 13.33 x 7.5, set before adding slides
    ppt.author = "CortexAI";
    ppt.title = data?.title || "Presentation";
    ppt.subject = data?.title || "Presentation";
    ppt.company = "CortexAI";
    ppt.lang = "en-US";
    ppt.theme = { headFontFace: FONT, bodyFontFace: FONT };

    const p = pickPalette(data);
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    const total = slides.length + 3; // cover + agenda + content + closing

    addCover(ppt, data, p);
    addAgenda(ppt, slides, p, total);

    slides.forEach((s, i) => {
        addContentSlide(ppt, s, p, i, i + 3, total);
    });

    addThankYou(ppt, data, p);

    return ppt;
};