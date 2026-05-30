# Chinese Character Learner

A web app for learning Chinese characters. Type pinyin and get matching
characters or whole words, with English meanings, example words, and animated
stroke order you can practice writing yourself.

- **Type a syllable** (`shi`) → every common character with that sound, ranked
  most-common-first. Tap one for its meaning, example words, and stroke order.
- **Type a word** (`luyou`, `juede`, `nihao`) → the matching word with its
  meaning and how to write each character.
- Tone is optional: `shi`, `shi4`, and `shì` all work (a tone narrows results).
- Runs fully in the browser — no backend, no API keys.

## Tech

- **React + Vite** single-page app.
- **[Hanzi Writer](https://hanziwriter.org/)** for stroke-order animation and
  the draw-it-yourself practice mode.
- Data built at build time from **CC-CEDICT** (dictionary + pinyin) and the
  **jieba** dictionary (real usage frequencies for ranking).

## Develop

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests (pinyin parsing + search)
npm run build    # production build into dist/
```

## Rebuilding the data

The app ships with prebuilt data in `src/data/`. To regenerate it:

```bash
# Download the raw sources into data/raw/ (gitignored):
#   - CC-CEDICT: https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
#                (decompress to data/raw/cedict.txt)
#   - jieba dict: https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt
#                (save as data/raw/jieba-dict.txt)
npm run build:data
```

This selects the ~3,000 most common characters and ~14,000 most common words and
writes `characters.json`, `pinyin-index.json`, and `word-index.json`.

## License / data attribution

- CC-CEDICT — Creative Commons Attribution-ShareAlike 4.0.
- jieba dictionary — MIT.
- Stroke data via Hanzi Writer / Make Me a Hanzi — see their licenses.
