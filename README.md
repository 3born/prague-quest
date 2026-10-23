# Prague City Quest

A static, mobile-first team game for Prague. Plain HTML/CSS/JS with no build step, plus Leaflet 1.9.4.
Live at `https://3born.github.io/prague-quest/` once Pages is enabled.

## Links to share

| Who | Link |
|---|---|
| Team A | `https://3born.github.io/prague-quest/#team-a` |
| Team B | `https://3born.github.io/prague-quest/#team-b` |
| Judge | `https://3born.github.io/prague-quest/#judge` (don't share) |

The site opens on a landing page with both team rosters. Players tap their team, or open a team link, which picks the team directly. "Send to judge" opens WhatsApp with the answer filled in; players pick the judge's chat. (Set `judgePhone` to send straight to one number.) All photos go to the Facebook chat (`photoChatName`, plus an optional `photoChatUrl` to link it).

"Not your team? Switch" logs that phone out. Its progress stays saved for when the team logs back in. Team progress is saved in `localStorage` on each phone. Judge scores and the judge's answer key are saved only on the judge's phone.

**No answers are in this repo.** The judge can type the answer key into the judge page (under "My answer key"). It is stored only in that browser.

## Before game day: edit `js/data.js`

- `startAt` / `finishAt`: the game day and times (Prague is UTC+2 until the last Sunday of October, then UTC+1).
- `finishPlace`: the pub's name.
- `cartoKey`: CARTO basemaps now need a free key (request one at <https://carto.com/basemaps/apikey>, then restrict it to `3born.github.io`). Without a key the map uses standard OpenStreetMap tiles, darkened in dark mode.
- Stop coordinates are approximate. Check each pin in Google Maps.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To test on a phone on the same Wi-Fi, use `http://<computer-ip>:8000`. GPS ("How far?") only works over HTTPS or on localhost, so test it after deploying.

## Deploy

1. Create the empty repo `3born/prague-quest` on GitHub.
2. Push this folder to `main`.
3. Go to Settings → Pages → Deploy from branch → `main` / root.

## Files

- `index.html`: the shell and tab bar
- `css/style.css`: the design, with light and dark tokens
- `js/data.js`: config, stops, questions, hints and bonus tasks (no answers)
- `js/app.js`: hash router (`#home`, `#stops`, `#stop-N`, `#rules`, `#judge`, `#team-a`, `#team-b`), progress, WhatsApp sending and judge scoring
