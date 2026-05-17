# Tunisian Meme Voice Mode — Audio Files

Drop mp3 or wav files into the matching sub-folder to override the
synthesized sounds. Files are picked **randomly** from each folder.

## Folder structure

```
public/audio/meme/
  queen-capture/   ← plays when any queen is captured
  check/           ← plays when check is given
  checkmate/       ← plays when the game ends by checkmate
  illegal-move/    ← plays when an invalid move is attempted
  win/             ← plays when the local player wins
  lose/            ← plays when the local player loses
  blunder/         ← plays after a big material loss (≥3 pts)
  promotion/       ← plays when a pawn is promoted
```

## Naming convention (optional)

Name your files anything you want — the manager picks randomly:

```
queen-capture/yasrebi.mp3
queen-capture/laarbi.mp3
queen-capture/shock.wav
```

## Register new files

After dropping files in the correct folder, open:

  src/lib/meme-audio/audio-manager.ts

and add the file names to the `MEME_AUDIO_FILES` map:

```ts
const MEME_AUDIO_FILES: Record<MemeEvent, string[]> = {
  "queen-capture": ["yasrebi.mp3", "laarbi.mp3", "shock.wav"],
  ...
};
```

If a folder is empty (default), the system falls back to the
built-in synthesized reaction sounds automatically.

## Volume & cooldown

Controlled from Settings → Meme Mode (slider + toggle).
Default volume: 70%, cooldown: 800 ms between sounds.
