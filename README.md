# KeyAnalyzer.by.yanmaizhou329

A real-time osu!mania 4K key pattern analyzer overlay for **tosu**. Displays pattern ratios and timeline analysis during gameplay.

## Features

- **Pattern Ratios**: Shows the percentage distribution of 4 main key patterns (Jack, Stream, JHS, Tech)
- **Sub Patterns**: Detailed breakdown of 12 sub-patterns:
  - Jack: Jack-S (小叠), Jack-M (中叠), Jack-L (大叠)
  - JHS: JHS-JS (双押), JHS-HS (三押), JHS-QS (四押)
  - Stream: Stream-N (普通), Stream-C (大乱)
  - Tech: Tech-J (叠Tech), Tech-S (Stream Tech), Tech-M (JHS Tech), Tech-P (纯Tech)
- **Timeline Analysis**: Visual timeline showing pattern distribution across the entire beatmap
- **Real-time Updates**: Automatically updates when switching beatmaps
- **Zero Dependency**: Pure frontend implementation, no Python or external services required

## Prerequisites

- [tosu](https://github.com/MaxOhn/tosu) - A standalone osu! server emulator

## Installation

### 1. Install the Plugin

Copy the entire `KeyAnalyzer.Native` folder to your tosu `static` directory:

```
tosu/static/
└── KeyAnalyzer.Native/
    ├── index.html
    ├── config.js
    ├── metadata.txt
    ├── settings.json
    ├── js/
    │   ├── socket.js
    │   └── app/
    │       ├── main.js
    │       ├── analysis.js
    │       ├── analyzer.js
    │       ├── display.js
    │       ├── settings.js
    │       └── socketHandlers.js
    └── styles/
        └── main.css
```

### 2. Enable in tosu

1. Open tosu
2. Go to Settings → Counters
3. Select "KeyAnalyzer" from the installed counters list

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        tosu                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  KeyAnalyzer Plugin (HTML/CSS/JS)                   │   │
│  │  - Fetches beatmap file via HTTP                    │   │
│  │  - Listens for beatmap changes via WebSocket        │   │
│  │  - Analyzes key patterns in browser (Native JS)     │   │
│  │  - Renders analysis results                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Edit `config.js` to change API endpoints:

```javascript
export const APP_CONFIG = {
    endpoint: "http://127.0.0.1:24050/files/beatmap/file",  // tosu beatmap API
    socketHost: "127.0.0.1:24050",                         // tosu WebSocket
};
```

## Pattern Color Legend

| Pattern | Color | Sub-patterns |
|---------|-------|--------------|
| Jack | Red (#e74c3c) | Jack-S, Jack-M, Jack-L |
| Stream | Blue (#3498db) | Stream-N, Stream-C |
| JHS | Green (#2ecc71) | JHS-JS, JHS-HS, JHS-QS |
| Tech | Orange (#f39c12) | Tech-J, Tech-S, Tech-M, Tech-P |

## License

MIT License

## Credits

- Key pattern analysis algorithm based on osu!mania 4K pattern recognition research
- WebSocket connection implementation inspired by [ManiaMapAnalyser.by.Leo_Black](https://github.com/Leo-Black/ManiaMapAnalyser)

## Contributing

Feel free to submit issues and pull requests!

## Support

If you encounter any issues, please check:
1. tosu is running and the WebSocket connection is available on port 24050
2. The plugin folder is correctly placed in the tosu `static` directory