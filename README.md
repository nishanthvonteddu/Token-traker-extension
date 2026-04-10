# Token Tracker

Premium token tracker for AI chat platforms. Monitor context window consumption in real-time.

## Overview
Token Tracker is a browser extension that intercepts and tracks your token usage across major AI platforms. It provides a resizable, floating widget directly on the AI chat page so you can easily keep an eye on your context window consumption without interrupting your workflow.

## How It Works
- **Network Interception**: An injected script (`interceptor.js`) runs in the page's MAIN execution world to transparently intercept `fetch` and `XMLHttpRequest` calls made by the AI chat UI.
- **Data Parsing**: It parses API responses locally on your device to extract token usage data securely without compromising your prompts or reading your private chat history.
- **Live Widgets**: The extracted token and context consumption is instantly relayed to a `content.js` script, which renders and updates the draggable floating overlay in real-time.

## Supported Platforms
- [ChatGPT](https://chatgpt.com)
- [Claude](https://claude.ai)
- [Gemini](https://gemini.google.com)
- [DeepSeek](https://chat.deepseek.com)

## Features
- **Real-time Monitoring**: Domain-aware network interception tracks your active usage automatically.
- **Floating UI Widget**: A sleek, resizable floating pane displaying the context usage data.
- **Privacy First**: Uses local storage. Bypasses CSP safely using MAIN world execution for its network interceptor. 

## Installation
1. Clone or download this repository.
2. Open Google Chrome (or any Chromium-based browser) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select this extension's directory.
5. Open an AI chat platform (like ChatGPT or Claude) to see the widget in action!
