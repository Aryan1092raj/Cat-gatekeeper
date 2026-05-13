# Cat Gatekeeper (Unpacked Extension)

Cat Gatekeeper is a lightweight Chrome extension that lets you add multiple websites and show a fullscreen cat after a per-site timer. No accounts, no tracking, no Chrome Web Store fee.

## Features

- Multiple websites, each with its own timer (minutes)
- Fullscreen cat overlay appears after time is up
- Dismiss, Go back, or Unblock options
- Timer resets when you switch tabs
- Local-only storage (no sync, no servers)

## Install (no $5 fee)

1. Download the GitHub ZIP and extract it
2. Open chrome://extensions/
3. Turn on Developer mode
4. Click Load unpacked
5. Select the catgatekeeper folder

Chrome will show a "Disable Developer Mode Extensions" banner. This is normal for unpacked extensions and cannot be removed without publishing to the Chrome Web Store.

## Folder Structure

```
cat/
├── README.md
└── catgatekeeper/
    ├── manifest.json
    ├── content.js
    ├── popup.html
    ├── popup.js
    ├── styles.css
    ├── animated-cat-tail.gif
    ├── cat-bg.gif
    └── icons/
```

## Customize Cats

- Foreground cat: replace `catgatekeeper/animated-cat-tail.gif`
- Background GIF: replace `catgatekeeper/cat-bg.gif`

Keep the same filenames so the extension continues to load them.

## Notes

- The timer starts when you open a site and resets when you switch tabs.
- The cat overlay is local and offline-safe.
