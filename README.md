# guitar-tuner

A live, in-browser guitar tuner. Dark analog meter, YIN pitch detection, reference tones, and common alternate tunings. No accounts, no backend, no analytics.

**Live site:** https://krhogan2.github.io/guitar-tuner/

## Open locally

Microphone access requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): `https://` or `localhost`. Opening the HTML file directly (`file://`) will not allow the mic.

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

## How to use

1. Press **Start tuner** and allow the microphone.
2. Play a string. The needle shows cents sharp or flat; the note and octave update live.
3. Tap a string to hear a reference tone (Web Audio oscillator) and lock that string as the target. **Auto** returns to nearest-string detection.

Tunings: Standard (E2 A2 D3 G3 B3 E4), Drop D, DADGAD, Open G, Open D, and half-step down.

## Deploy

The site is static (`index.html`, `css/`, `js/`). GitHub Pages is deployed from `main` by [`.github/workflows/pages.yml`](.github/workflows/pages.yml). After merge, the workflow enables Pages (Actions source) and publishes the artifact to https://krhogan2.github.io/guitar-tuner/

Asset paths are relative so the app works both at the domain root and under `/guitar-tuner/`.
