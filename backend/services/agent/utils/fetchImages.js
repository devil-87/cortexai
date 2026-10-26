// utils/fetchImages.js
// 1) Real people  -> photos from Wikimedia Commons (free licenses, shows the REAL person)
// 2) Everything else -> relevant Unsplash stock photos
// Both return base64 data URIs that generatePpt.js can place on slides.

const UA = "CortexAI/1.0 (https://github.com/devil-87/cortexai; ppt generator)";

const toDataUri = async (url, headers = {}) => {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
    if (!res.ok) throw new Error(`image download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return "image/jpeg;base64," + buf.toString("base64");
};

const stripHtml = (s = "") =>
    String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/* ---------------- WIKIMEDIA COMMONS (real people) ---------------- */

const COMMONS = "https://commons.wikimedia.org/w/api.php";

const commonsQuery = async (params) => {
    const url =
        COMMONS +
        "?" +
        new URLSearchParams({
            action: "query",
            format: "json",
            prop: "imageinfo",
            iiprop: "url|mime|size|extmetadata",
            iiurlwidth: "1000",
            ...params,
        });
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const json = await res.json();
    return Object.values(json?.query?.pages || {});
};

// keep only real, freely licensed JPEG photos
const usable = (page) => {
    const info = page?.imageinfo?.[0];
    if (!info || info.mime !== "image/jpeg") return null;
    if ((info.width || 0) < 600 || (info.height || 0) < 600) return null;

    const meta = info.extmetadata || {};
    const license = meta.LicenseShortName?.value || "";
    if (!/^(CC|Public domain|PD)/i.test(license)) return null;

    return {
        url: info.thumburl || info.url,
        credit: `${stripHtml(meta.Artist?.value) || "Unknown"} / Wikimedia Commons / ${license}`,
    };
};

export const fetchPersonPhotos = async (personName, count = 7) => {
    try {
        if (!personName) return [];

        // 1) the person's own Commons category (most accurate)
        let pages = await commonsQuery({
            generator: "categorymembers",
            gcmtitle: `Category:${personName}`,
            gcmtype: "file",
            gcmlimit: "50",
        });

        // 2) fallback: file search by name
        if (!pages.length) {
            pages = await commonsQuery({
                generator: "search",
                gsrsearch: `${personName} filetype:bitmap`,
                gsrnamespace: "6",
                gsrlimit: "30",
            });
            // search can return unrelated files, so require the name in the file title
            const last = personName.toLowerCase().split(" ").pop();
            pages = pages.filter((p) => String(p.title).toLowerCase().includes(last));
        }

        const good = pages.map(usable).filter(Boolean).slice(0, count);

        const out = await Promise.all(
            good.map(async (g) => {
                try {
                    return { data: await toDataUri(g.url), credit: g.credit };
                } catch {
                    return null;
                }
            })
        );
        return out.filter(Boolean);
    } catch (err) {
        console.error("fetchPersonPhotos failed:", err.message);
        return [];
    }
};

/* ---------------- UNSPLASH (generic topic photos) ---------------- */

const describe = (photo) =>
    [
        photo?.alt_description,
        photo?.description,
        ...(photo?.tags || []).map((t) => t?.title),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

export const fetchStockImage = async (query, topic = "") => {
    try {
        const key = process.env.UNSPLASH_ACCESS_KEY;
        if (!key || !query) return null;

        const q = `${topic} ${query}`.trim();
        const api =
            "https://api.unsplash.com/search/photos" +
            `?query=${encodeURIComponent(q)}&per_page=10&content_filter=high`;

        const res = await fetch(api, { headers: { Authorization: `Client-ID ${key}` } });
        if (!res.ok) return null;

        const results = (await res.json())?.results || [];
        const t = topic.toLowerCase().trim();
        const photo = t ? results.find((p) => describe(p).includes(t)) : results[0];

        const url = photo?.urls?.regular;
        return url ? await toDataUri(url) : null;
    } catch (err) {
        console.error("fetchStockImage failed:", query, err.message);
        return null;
    }
};

/* ---------------- MAIN ---------------- */

// Sets data.coverImage, slides[i].image and data.credits
export const attachImages = async (data) => {
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    const topic = String(data?.imageTopic || "").trim();
    let personName = String(data?.personName || "").trim();
    if (/^(null|none|n\/a|undefined)$/i.test(personName)) personName = "";

    // real photos of the person first (cover + as many slides as we find)
    const person = personName ? await fetchPersonPhotos(personName, slides.length + 1) : [];
    const credits = [];

    const take = (i) => {
        const p = person[i];
        if (!p) return null;
        credits.push(p.credit);
        return p.data;
    };

    // slides with no real photo fall back to relevant stock photos
    const [cover, ...rest] = await Promise.all([
        person[0] ? Promise.resolve(take(0)) : fetchStockImage(data.imageQuery || data.title, topic),
        ...slides.map((s, i) =>
            person[i + 1]
                ? Promise.resolve(take(i + 1))
                : fetchStockImage(s.imageQuery || s.title, topic)
        ),
    ]);

    data.coverImage = cover;
    slides.forEach((s, i) => {
        s.image = rest[i];
    });
    data.credits = [...new Set(credits)];
    return data;
};