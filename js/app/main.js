import { APP_CONFIG } from "../../config.js";
import WebSocketManager from "../socket.js";
import { analyzeBeatmap } from "./analysis.js";
import { renderAnalysis, renderError, showLoading, hideLoading, setSettings, updateTimelineWidth } from "./display.js";
import { handleSocketMessage } from "./socketHandlers.js";
import { loadSettings, getSettings, setSettingsChangedCallback } from "./settings.js";

const socket = new WebSocketManager(APP_CONFIG.socketHost);

let currentAnalysisData = null;

function onSettingsChanged(settings) {
    setSettings(settings);
    if (currentAnalysisData) {
        renderAnalysis(currentAnalysisData);
    }
}

async function fetchBeatmapFile() {
    try {
        showLoading();
        renderError(null);

        const response = await fetch(APP_CONFIG.endpoint, {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const rawText = await response.text();
        if (!rawText || !rawText.trim()) {
            throw new Error("Empty beatmap content.");
        }

        const analysisResult = await analyzeBeatmap(rawText);
        if (analysisResult.success && analysisResult.data) {
            currentAnalysisData = analysisResult.data;
            renderAnalysis(analysisResult.data);
        } else {
            renderError(analysisResult.error || "Analysis failed");
        }
    } catch (error) {
        console.error("[KeyAnalyzer] Fetch beatmap error:", error);
        renderError(error.message || "Failed to fetch beatmap");
    } finally {
        hideLoading();
    }
}

function setupSocketListener() {
    socket.api_v2((data) => {
        const settings = getSettings();
        if (settings.autoRefresh) {
            handleSocketMessage(data, () => {
                fetchBeatmapFile();
            });
        }
    });
}

function setupResizeListener() {
    window.addEventListener("resize", () => {
        updateTimelineWidth();
    });
}

async function initialize() {
    console.log("[KeyAnalyzer] Initializing...");
    
    setSettingsChangedCallback(onSettingsChanged);
    await loadSettings(socket);
    
    const initialSettings = getSettings();
    setSettings(initialSettings);
    
    setupSocketListener();
    setupResizeListener();
    fetchBeatmapFile();
}

initialize();