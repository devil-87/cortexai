// utils/researchTopic.js
// Looks the topic up on the live web (Tavily) so the slides use CURRENT facts,
// not the LLM's older training data.
// Needs TAVILY_API_KEY in your .env (use the same name as your config/tavily.js).

const tavily = async (query, maxResults = 5) => {
    const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
            query,
            search_depth: "advanced",
            max_results: maxResults,
            include_answer: true,
        }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    return res.json();
};

export const researchTopic = async (topic) => {
    try {
        if (!process.env.TAVILY_API_KEY) {
            console.warn("researchTopic: TAVILY_API_KEY missing, skipping research");
            return { text: "", sources: [] };
        }

        const year = new Date().getFullYear();

        // several focused searches = better coverage than one
        const queries = [
            `${topic} latest news and current statistics ${year}`,
            `${topic} biography early life debut first achievement`,
            `${topic} career records best performance milestones`,
        ];

        const settled = await Promise.allSettled(queries.map((q) => tavily(q)));

        const seen = new Set();
        const chunks = [];
        const sources = new Set();

        for (const r of settled) {
            if (r.status !== "fulfilled") continue;
            if (r.value.answer) chunks.push(`SUMMARY: ${r.value.answer}`);

            for (const item of r.value.results || []) {
                if (!item?.url || seen.has(item.url)) continue;
                seen.add(item.url);
                chunks.push(
                    `SOURCE: ${item.title} (${item.url})\n${String(item.content || "").slice(0, 1200)}`
                );
                try {
                    sources.add(new URL(item.url).hostname.replace(/^www\./, ""));
                } catch {}
            }
        }

        return {
            text: chunks.join("\n\n").slice(0, 14000),
            sources: [...sources].slice(0, 5),
        };
    } catch (err) {
        console.error("researchTopic failed:", err.message);
        return { text: "", sources: [] };
    }
};