# Google Maps platform setup

This app can render maps with **Google Maps** when users choose **Google** in the basemap toggle (Parcelis and Fieldstone workspaces under PropertyVision). Client-side code uses the Maps JavaScript API plus optional Geocoding and Places features.

## Environment variable

Add to `.env.local` (restart `next dev` after changing):

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_restricted_key_here
```

The existing Mapbox flow continues to use:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

## Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.

2. **Enable APIs** used by this app:
   - **Maps JavaScript API** (required for the map)
   - **Geocoding API** (reverse geocode / address lookup from map clicks and search)
   - **Places API** (only if your build uses Places Autocomplete for search; enable if geocoder search fails with Places-related errors)

3. **Credentials:** APIs & Services → Credentials → Create credentials → API key.

4. **Restrict the key (recommended):**
   - Application restriction: **HTTP referrers (web sites)**  
     Add your origins, for example:
     - `http://localhost:3000/*`
     - `http://127.0.0.1:3000/*` (needed if you open the app at `127.0.0.1` instead of `localhost`)
     - `https://your-production-domain.com/*`
   - API restriction: limit to the APIs you enabled above.

5. Billing must be enabled on the project for Maps Platform usage (Google provides a monthly credit; see current Google Maps Platform pricing).

## Troubleshooting

- **“Oops! Something went wrong” / gray map:** Usually key restriction or billing/API setup. Open DevTools → **Console** and look for messages such as `RefererNotAllowedMapError`, `ApiNotActivatedMapError`, `InvalidKeyMapError`, or billing warnings. Fix referrers (including `127.0.0.1` vs `localhost`), enable **Maps JavaScript API**, and ensure billing is active.
- **Referrer errors:** The browser’s origin must match an allowed referrer pattern exactly (scheme, host, **port**, trailing `*`).
- **Geocoding failures:** Confirm Geocoding API is enabled and the key is allowed to call it.
- **Blank map:** Confirm Maps JavaScript API is enabled and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set and restart `npm run dev` after edits to `.env.local`.

Parcelis and Fieldstone share **one** Maps loader configuration (`src/lib/maps/googleMapsLoader.ts`) so navigating between products does not reload the script with conflicting options.
