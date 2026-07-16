let lastBeatmapKey = "";

function normalizeText(value) {
    if (value == null) return "";
    return String(value).trim();
}

function normalizeNumberText(value) {
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : "";
}

export function handleSocketMessage(data, onBeatmapChange) {
    if (!data) return;

    const beatmap = data?.beatmap;
    if (!beatmap) return;

    const beatmapKey = [
        normalizeNumberText(beatmap?.id),
        normalizeText(data?.files?.beatmap),
        normalizeText(data?.directPath?.beatmapFile),
        normalizeText(beatmap?.md5 || beatmap?.checksum),
        [
            normalizeText(beatmap?.artist),
            normalizeText(beatmap?.title),
            normalizeText(beatmap?.version),
            normalizeText(beatmap?.mapper),
        ].join("::"),
        normalizeNumberText(beatmap?.time?.firstObject),
        normalizeNumberText(beatmap?.time?.lastObject),
        normalizeNumberText(beatmap?.stats?.od?.original),
    ].join("|");

    if (beatmapKey.replace(/\|/g, "").length === 0) return;

    if (!beatmapKey || beatmapKey === lastBeatmapKey) return;

    console.log("[KeyAnalyzer] Beatmap changed:", lastBeatmapKey, "->", beatmapKey);
    lastBeatmapKey = beatmapKey;

    if (typeof onBeatmapChange === "function") {
        onBeatmapChange(true);
    }
}