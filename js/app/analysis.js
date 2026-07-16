import { analyzeBeatmap as analyzeBeatmapNative } from "./analyzer.js";

export async function analyzeBeatmap(osuContent) {
    try {
        console.log("[KeyAnalyzer] Analyzing beatmap locally...");
        
        const result = analyzeBeatmapNative(osuContent);
        console.log("[KeyAnalyzer] Analysis result:", result);
        
        return result;
    } catch (error) {
        console.error("[KeyAnalyzer] Analysis error:", error);
        return {
            success: false,
            error: error.message || "Analysis error",
        };
    }
}