# Love at first spear

A small birthday browser game inspired by spear-throwing arcade games. Original drawings and code; seven levels, falling ragdolls, photo rewards, a triggerfish loss screen, and a birthday ending.

## Local draft

Run `npm start`, then open http://localhost:3000. No installation or build step is needed. Drag on the game to aim; release to throw. Arrow keys adjust the aim, Space throws, and P pauses. There is no trajectory guide. Five lives per level, unlimited retries. Sound is optional.

The seven levels have 1, 1, 1, 2, 2, 3, and 3 enemies. The new opening level has one enemy with slower spears and a six-second attack interval; the following six levels preserve the original difficulty curve. Defeated enemies become articulated ragdolls. The photo appears only after every enemy has died and every body has left the screen. Next advances to the next level. Losing restarts only the current level with full health and fresh enemies; completed levels stay cleared.

Levels 6 and 7 have enemies that require two body hits or one headshot, faster projectiles, and shorter attack intervals. The final screen includes the last photo, a Lisan al Gaib GIF beneath it, and the love message. The GIF is bundled locally; source: https://tenor.com/view/dune-stilgar-lisanalgaib-fremen-lisan-al-gaib-gif-13633185611076219756

## Photos

The game fills the available viewport edge to edge, including after rotation and mobile browser-toolbar changes. A fixed 960×540 arena scales uniformly inside the full-screen scene, with extended scenery filling wider or taller screens. Touch aiming uses the same scale and offset. This preserves character proportions, physics, and progress during resizing. Phones show a rotate prompt in portrait, and rotation during play pauses the game without resetting it.

Play, retry, and resume request native fullscreen and landscape locking where supported. Browsers may require the user gesture or reject fullscreen/locking; the game still fills the available browser viewport in that case. Safe-area insets keep controls away from notches, and the fullscreen button remains available.

The 21 photos from `photo_level_win/` are copied unchanged into `public/assets/photos/win/`. Level 1 shows 1.1, 1.2, then 1.3. The remaining levels preserve the original numbered order: level 2 shows 1–3, level 3 shows 4–6, and so on. Each level stays paused while the player taps through the photos; Next level appears after the last photo. The final level shows 16, 17, then the ending with photo 18 and the GIF. Previous photo allows browsing back within a group. Photos are shown uncropped.

`public/photos.json` contains seven `memories` entries, each with a `photos` array and a shared `caption`. Its `lossImages` array rotates the four supplied loss images on successive deaths, including the WhatsApp fish meme copied as `triggerfish4.jpeg`. Originals stay in their source folders. Bundled SVG illustrations are fallbacks if an image fails to load. All served assets are inside `public/`, which is included in the Railway Docker image.

## Music

The supplied `Beretta (De Los Cerros La Escuela).mp3` is copied to `public/assets/music/background.mp3`. It starts on Play at 22% volume, loops, and keeps its position through retries and photo screens. Sound toggles both music and effects. Hiding the tab pauses playback; returning resumes it if sound was enabled. Browsers that deny audio still allow the game to run.

## Railway

The included Dockerfile runs the Node static server. It listens on `0.0.0.0` and Railway's `PORT` environment variable (3000 locally). Deploy this directory from a repository or Railway CLI, then generate a public domain for the service. Make the birthday QR code from that final HTTPS address. This draft has not been deployed.
