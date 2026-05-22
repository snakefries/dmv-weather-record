# DMV Weather Record

A static weather dashboard for the Washington/Baltimore airport stations:

- National / DCA
- Dulles / IAD
- BWI

The page shows current observations, forecast temperature ranges, official temperature records, monthly precipitation, and precipitation table values.

## Data Sources

This site runs entirely in the visitor's browser. It does not have a backend service.

Live data is fetched directly from public APIs:

- NOAA/NWS API for current observations, forecasts, recent hourly precipitation, and recent observed temperatures.
- ACIS / RCC API for climate normals, records, and monthly/daily precipitation summaries.

Because the browser fetches those services directly, the hosted page depends on those public APIs being reachable from the visitor's network and allowing browser requests. If either provider is temporarily unavailable, some dashboard sections may show unavailable or stale-looking values until the APIs recover.

This site is unofficial and not endorsed by NOAA, the National Weather Service, the Regional Climate Centers, or any news organization.

## Run Locally

Use any static file server from the repo root. For example:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

## Verify

The dashboard check starts a temporary local server and verifies the page in mobile and desktop browser viewports:

```sh
npm run check:dashboard
```

## Publish

This is a static site, so it can be hosted by GitHub Pages, Netlify, Cloudflare Pages, Vercel, or any ordinary static web host.

For GitHub Pages:

1. Push the repo to GitHub.
2. Open the repo settings.
3. Go to Pages.
4. Choose "Deploy from a branch."
5. Select the main branch and the repo root.

GitHub will provide a public URL after the first deployment finishes.
