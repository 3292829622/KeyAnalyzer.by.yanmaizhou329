const PATTERN_COLORS = {
    Jack: "#e74c3c",
    Stream: "#3498db",
    JHS: "#2ecc71",
    Tech: "#f39c12",
    Unknown: "#7f8c8d",
};

const SUB_PATTERN_COLORS = {
    "Jack-S": "#ff8787",
    "Jack-M": "#e74c3c",
    "Jack-L": "#b91c1c",
    "JHS-JS": "#6ee7b7",
    "JHS-HS": "#10b981",
    "JHS-QS": "#059669",
    "Stream-N": "#74b9ff",
    "Stream-C": "#1e40af",
    "Tech-J": "#fde066",
    "Tech-S": "#f59e0b",
    "Tech-M": "#fbbf24",
    "Tech-P": "#ea580c",
    Unknown: "#7f8c8d",
};

const patternBarsEl = document.getElementById("pattern-bars");
const subPatternBarsEl = document.getElementById("sub-pattern-bars");
const timelineContainerEl = document.getElementById("timeline-container");
const timelineLegendEl = document.getElementById("timeline-legend");
const errorDisplayEl = document.getElementById("error-display");
const loadingEl = document.getElementById("loading");
const patternSectionEl = document.getElementById("pattern-section");
const subPatternSectionEl = document.getElementById("sub-pattern-section");
const timelineSectionEl = document.getElementById("timeline-section");
const mainContainerEl = document.getElementById("main-container");

let currentSettings = {
    showPatternRatios: true,
    showSubPatterns: true,
    showTimeline: true,
    showTimelineLegend: true,
    transparentBackground: false,
    backgroundOpacity: 0.95,
};

export function setSettings(settings) {
    currentSettings = { ...currentSettings, ...settings };
    applySettingsVisibility();
    applyBackgroundSettings();
}

function applySettingsVisibility() {
    if (patternSectionEl) {
        patternSectionEl.classList.toggle("hidden-section", !currentSettings.showPatternRatios);
    }
    if (subPatternSectionEl) {
        subPatternSectionEl.classList.toggle("hidden-section", !currentSettings.showSubPatterns);
    }
    if (timelineSectionEl) {
        timelineSectionEl.classList.toggle("hidden-section", !currentSettings.showTimeline);
    }
    if (timelineLegendEl) {
        timelineLegendEl.style.display = currentSettings.showTimelineLegend ? "flex" : "none";
    }
}

function applyBackgroundSettings() {
    if (mainContainerEl) {
        if (currentSettings.transparentBackground) {
            mainContainerEl.classList.add("transparent-bg");
            mainContainerEl.style.background = `rgba(17, 17, 17, ${currentSettings.backgroundOpacity * 0.2})`;
            mainContainerEl.style.backdropFilter = "blur(20px)";
            mainContainerEl.style.WebkitBackdropFilter = "blur(20px)";
        } else {
            mainContainerEl.classList.remove("transparent-bg");
            mainContainerEl.style.background = `rgba(17, 17, 17, ${currentSettings.backgroundOpacity})`;
            mainContainerEl.style.backdropFilter = "none";
            mainContainerEl.style.WebkitBackdropFilter = "none";
        }
    }
}

export function renderAnalysis(data) {
    applySettingsVisibility();
    
    if (currentSettings.showPatternRatios) {
        renderPatternBars(data);
    }
    if (currentSettings.showSubPatterns) {
        renderSubPatternBars(data);
    }
    if (currentSettings.showTimeline) {
        renderTimeline(data);
    }
}

function renderPatternBars(data) {
    if (!patternBarsEl || !data || !data.pattern_ratios) return;

    const patternOrder = ["Jack", "Stream", "JHS", "Tech"];

    const bars = patternOrder.map((pattern) => {
        const ratio = data.pattern_ratios[pattern] || 0;
        const color = PATTERN_COLORS[pattern] || "#7f8c8d";

        return `
            <div class="pattern-bar-item">
                <div class="pattern-bar-label">${pattern}</div>
                <div class="pattern-bar-track">
                    <div class="pattern-bar-fill" style="width: ${ratio}%; background: ${color}"></div>
                </div>
                <div class="pattern-bar-value">${ratio.toFixed(1)}%</div>
            </div>
        `;
    }).join("");

    patternBarsEl.innerHTML = bars;
}

function renderSubPatternBars(data) {
    if (!subPatternBarsEl || !data || !data.sub_pattern_ratios) return;

    const subPatternOrder = [
        "Jack-S", "Jack-M", "Jack-L",
        "JHS-JS", "JHS-HS", "JHS-QS",
        "Stream-N", "Stream-C",
        "Tech-J", "Tech-S", "Tech-M", "Tech-P",
    ];

    const bars = subPatternOrder.map((subPattern) => {
        const ratio = data.sub_pattern_ratios[subPattern] || 0;
        if (ratio === 0) return "";
        
        const color = SUB_PATTERN_COLORS[subPattern] || "#7f8c8d";

        return `
            <div class="sub-pattern-bar-item">
                <div class="sub-pattern-bar-label">${subPattern}</div>
                <div class="sub-pattern-bar-track">
                    <div class="sub-pattern-bar-fill" style="width: ${ratio}%; background: ${color}"></div>
                </div>
                <div class="sub-pattern-bar-value">${ratio.toFixed(1)}%</div>
            </div>
        `;
    }).join("");

    subPatternBarsEl.innerHTML = bars;
}

function renderTimeline(data) {
    if (!timelineContainerEl || !data || !data.timeline) return;

    const timeline = data.timeline;
    
    if (!timelineContainerEl.parentElement.classList.contains('timeline-container-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'timeline-container-wrapper';
        timelineContainerEl.parentNode.insertBefore(wrapper, timelineContainerEl);
        wrapper.appendChild(timelineContainerEl);
    }

    const containerWidth = timelineContainerEl.parentElement.offsetWidth;
    const itemWidth = Math.max(4, Math.floor(containerWidth / timeline.length));
    
    const items = timeline.map((item) => {
        const color = SUB_PATTERN_COLORS[item.sub_pattern] || PATTERN_COLORS[item.pattern] || "#7f8c8d";
        const opacity = item.pattern_score ? (0.5 + item.pattern_score / 100 * 0.5) : 0.7;

        return `
            <div 
                class="timeline-item" 
                style="background: ${color}; opacity: ${opacity}; width: ${itemWidth}px;"
                title="${item.sub_pattern} (Diff: ${item.difficulty?.toFixed(1) || '0'})"
            ></div>
        `;
    }).join("");

    timelineContainerEl.innerHTML = items;
    
    if (currentSettings.showTimelineLegend) {
        renderTimelineLegend();
    }
}

function renderTimelineLegend() {
    if (!timelineLegendEl) return;

    const legend = Object.entries(SUB_PATTERN_COLORS).map(([subPattern, color]) => `
        <div class="legend-item">
            <div class="legend-color" style="background: ${color}"></div>
            <div class="legend-text">${subPattern}</div>
        </div>
    `).join("");

    timelineLegendEl.innerHTML = legend;
}

export function renderError(message) {
    if (!errorDisplayEl) return;

    if (message) {
        errorDisplayEl.textContent = message;
        errorDisplayEl.style.display = "block";
    } else {
        errorDisplayEl.style.display = "none";
    }
}

export function showLoading() {
    if (loadingEl) {
        loadingEl.style.display = "block";
    }
}

export function hideLoading() {
    if (loadingEl) {
        loadingEl.style.display = "none";
    }
}

export function updateTimelineWidth() {
    const wrapper = timelineContainerEl?.parentElement;
    if (wrapper && wrapper.classList.contains('timeline-container-wrapper')) {
        const containerWidth = wrapper.offsetWidth;
        const items = timelineContainerEl.querySelectorAll('.timeline-item');
        if (items.length > 0) {
            const itemWidth = Math.max(4, Math.floor(containerWidth / items.length));
            items.forEach(item => {
                item.style.width = `${itemWidth}px`;
            });
        }
    }
}