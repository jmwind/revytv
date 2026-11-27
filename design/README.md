# Design sources

`og-card.html` is the 1200×630 link-preview card. It is not served; `public/og.png` is the rendered copy. After editing it, re-render with Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=8000 --screenshot="$PWD/public/og.png" "file://$PWD/design/og-card.html"
```
