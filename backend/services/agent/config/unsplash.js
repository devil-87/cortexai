// services/agent/config/unsplash.js
const cache = new Map()

// returns up to `count` real photos for a keyword
export const searchUnsplashImages = async (query, count = 3) => {
    const key = process.env.UNSPLASH_ACCESS_KEY
    if (!key) throw new Error("UNSPLASH_ACCESS_KEY is missing in .env")

    // same keyword twice = no extra request (saves your 50/hour limit)
    const cacheKey = `${query.toLowerCase()}|${count}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`
    const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${key}` }
    })
    if (!res.ok) throw new Error(`Unsplash error ${res.status}`)

    const data = await res.json()
    const images = (data.results || []).map((p) => ({
        url: `${p.urls.raw}&w=600&h=400&fit=crop&q=80`,
        alt: p.alt_description || query,
        photographer: p.user.name,
        profile: `${p.user.links.html}?utm_source=cortexai&utm_medium=referral`,
        downloadLocation: p.links.download_location
    }))

    cache.set(cacheKey, images)
    return images
}

// Unsplash asks apps to report when a photo is actually used (these calls don't count against the limit)
export const trackUnsplashDownloads = (images) => {
    const key = process.env.UNSPLASH_ACCESS_KEY
    images.forEach((img) => {
        fetch(img.downloadLocation, {
            headers: { Authorization: `Client-ID ${key}` }
        }).catch(() => {})
    })
}