const DEFAULT_SETTINGS = {
    showPatternRatios: true,
    showSubPatterns: true,
    showTimeline: true,
    showTimelineLegend: true,
    transparentBackground: false,
    backgroundOpacity: 0.95,
    autoRefresh: true,
};

let currentSettings = { ...DEFAULT_SETTINGS };
let settingsChangedCallback = null;

function normalizeBooleanSetting(value, fallback = false) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value !== 0;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
        if (normalized === "1") return true;
        if (normalized === "0") return false;
    }
    if (value === undefined || value === null) {
        return fallback;
    }
    return Boolean(value);
}

function normalizeOpacityValue(value, fallback = 0.95) {
    if (typeof value === "number") {
        return Math.max(0.1, Math.min(1, value));
    }
    if (typeof value === "string") {
        const match = value.trim().match(/^(\d+(\.\d+)?)%?$/);
        if (match) {
            const num = parseFloat(match[1]);
            if (num >= 0 && num <= 100) {
                return num / 100;
            }
            if (num >= 0 && num <= 1) {
                return num;
            }
        }
    }
    return fallback;
}

function extractSettingValue(settingsPayload, settingKey) {
    if (Array.isArray(settingsPayload)) {
        const item = settingsPayload.find((entry) => entry?.uniqueID === settingKey);
        return item?.value;
    }

    if (settingsPayload && typeof settingsPayload === "object") {
        if (Object.prototype.hasOwnProperty.call(settingsPayload, settingKey)) {
            return settingsPayload[settingKey];
        }

        if (settingsPayload.settings && typeof settingsPayload.settings === "object") {
            const nested = settingsPayload.settings;
            if (Object.prototype.hasOwnProperty.call(nested, settingKey)) {
                return nested[settingKey];
            }
        }
    }

    return undefined;
}

function applySettingsFromPayload(payload) {
    let changed = false;

    const showPatternRatios = normalizeBooleanSetting(
        extractSettingValue(payload, "showPatternRatios"),
        DEFAULT_SETTINGS.showPatternRatios
    );
    if (currentSettings.showPatternRatios !== showPatternRatios) {
        currentSettings.showPatternRatios = showPatternRatios;
        changed = true;
    }

    const showSubPatterns = normalizeBooleanSetting(
        extractSettingValue(payload, "showSubPatterns"),
        DEFAULT_SETTINGS.showSubPatterns
    );
    if (currentSettings.showSubPatterns !== showSubPatterns) {
        currentSettings.showSubPatterns = showSubPatterns;
        changed = true;
    }

    const showTimeline = normalizeBooleanSetting(
        extractSettingValue(payload, "showTimeline"),
        DEFAULT_SETTINGS.showTimeline
    );
    if (currentSettings.showTimeline !== showTimeline) {
        currentSettings.showTimeline = showTimeline;
        changed = true;
    }

    const showTimelineLegend = normalizeBooleanSetting(
        extractSettingValue(payload, "showTimelineLegend"),
        DEFAULT_SETTINGS.showTimelineLegend
    );
    if (currentSettings.showTimelineLegend !== showTimelineLegend) {
        currentSettings.showTimelineLegend = showTimelineLegend;
        changed = true;
    }

    const transparentBackground = normalizeBooleanSetting(
        extractSettingValue(payload, "transparentBackground"),
        DEFAULT_SETTINGS.transparentBackground
    );
    if (currentSettings.transparentBackground !== transparentBackground) {
        currentSettings.transparentBackground = transparentBackground;
        changed = true;
    }

    const backgroundOpacity = normalizeOpacityValue(
        extractSettingValue(payload, "backgroundOpacity"),
        DEFAULT_SETTINGS.backgroundOpacity
    );
    if (currentSettings.backgroundOpacity !== backgroundOpacity) {
        currentSettings.backgroundOpacity = backgroundOpacity;
        changed = true;
    }

    const autoRefresh = normalizeBooleanSetting(
        extractSettingValue(payload, "autoRefresh"),
        DEFAULT_SETTINGS.autoRefresh
    );
    if (currentSettings.autoRefresh !== autoRefresh) {
        currentSettings.autoRefresh = autoRefresh;
        changed = true;
    }

    if (changed && typeof settingsChangedCallback === "function") {
        settingsChangedCallback(currentSettings);
    }

    return changed;
}

function extractSettingsPayloadFromCommandPacket(packet) {
    if (Array.isArray(packet)) {
        return packet;
    }

    if (packet && typeof packet === "object" && packet.command === "getSettings") {
        return packet.message;
    }

    return null;
}

export function setupSettingsCommandListener(socket) {
    socket.commands((packet) => {
        const payload = extractSettingsPayloadFromCommandPacket(packet);
        if (!payload) {
            return;
        }

        applySettingsFromPayload(payload);
    });
}

export function getCounterPathForCommand() {
    if (typeof window.COUNTER_PATH === "string" && window.COUNTER_PATH.trim().length > 0) {
        return encodeURI(window.COUNTER_PATH);
    }

    const fallbackPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
    return encodeURI(fallbackPath);
}

export async function loadSettings(socket) {
    setupSettingsCommandListener(socket);

    try {
        const response = await fetch("./settings.json", {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`settings.json status ${response.status}`);
        }

        const settings = await response.json();
        applySettingsFromPayload(settings);
    } catch (error) {
        console.warn("[KeyAnalyzer] Failed to load settings.json, using defaults:", error);
    }

    socket.sendCommand("getSettings", getCounterPathForCommand());
}

export function getSettings() {
    return { ...currentSettings };
}

export function setSettingsChangedCallback(callback) {
    settingsChangedCallback = callback;
}