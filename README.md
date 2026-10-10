# MycoDex UK 🍄

A personal, mobile-friendly mushroom collection for the UK, inspired by the collecting mechanics of a Pokédex. **No API keys, build tools or hosting subscription required for the starter version.**

## What works now

- Browse and search the included **starter catalogue** of British fungi (not an exhaustive UK list).
- Track unique species found and percentage of the loaded catalogue completed.
- Record sighting date, place and field notes.
- Add several of your own photographs to a species; photographs are resized before saving.
- Filter by collected / not collected, group, or name; sort by recent findings.
- Import a larger species catalogue from an NBN Atlas (or similarly structured) CSV.
- Export a complete collection backup, **including photos**, and restore it on another device.
- Download the current species catalogue as `species.json` for committing to GitHub.
- Add the website to your iPhone/iPad home screen. The app shell can work offline after its first visit.

## Publish to GitHub Pages (iPhone / iPad / computer)

1. Create a **new GitHub repository**, for example `mycodex-uk`. Initialise it with **no other files** (or replace the default files).
2. Upload the **contents of this folder** to the **root of the repository**: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, and the `assets/` and `data/` folders. The `index.html` file must be at the root.
3. In repository **Settings → Pages**, set **Build and deployment → Deploy from a branch → main → /(root)** and Save.
4. GitHub will display the published website address once deployment succeeds. Open it in Safari.
5. In Safari, use **Share → Add to Home Screen** for app-like access.

The website will usually be at `https://YOUR-USERNAME.github.io/mycodex-uk/` (unless you configured a custom domain).

## Load thousands of UK species

The starter JSON is intentionally a small example: it would be misleading to claim there is one universally agreed list of *all mushrooms*. "Mushroom" is not a formal taxonomic rank and many fungi are microscopic, lichens, or are known only from specialist study.

### Recommended modern name source: NBN Atlas / UK Species Inventory

- NBN Atlas offers **species-name web service downloads**: https://nbnatlas.freshdesk.com/support/solutions/articles/201000131584-species-web-services
- Source names ultimately relate to the UK Species Inventory (UKSI), maintained by the Natural History Museum. Taxonomy changes over time.
- Request an accepted-species CSV with scientific names and taxonomy, ideally filtered for `kingdom=Fungi` and `rank=species`; include `scientificName`, `commonName`, `rk_family`, `rk_phylum`, `rk_kingdom`, `rank` if available.
- Import the downloaded CSV through **Data & backup → Choose species CSV**. The importer will recognise those common column names, skip non-fungi (when kingdom is provided), reject ranks other than species (when rank is provided), and merge scientific-name duplicates.
- To include **all recorded fungi** (morels, puffballs, brackets, jelly fungi, etc.), **leave the Basidiomycota-only tickbox unchecked**. Basidiomycota-only excludes many familiar ascomycete fungi including morels.
- Then tap **Download current species JSON** and commit that file as `data/species.json` in GitHub. After publishing, the full catalogue loads on any device visiting the site. Your **sightings and photographs are still device-local** unless you move them via backup.

An additional historical reference is Kew's *Checklist of British and Irish Basidiomycota* archive: https://sftp.kew.org/pub/data-repositories/basidiochecklist/ (archive of a dataset updated through 2020, not a current complete UK taxonomic list). Verify licence terms before republishing substantial dataset content, and provide appropriate source credit. NBN records and photos may have **different licences**; do not copy other people's photos without permission.

## Storage and sync — important

The starter records finds, imported species and compressed photographs in **IndexedDB in this browser on this device**. GitHub Pages cannot itself save private user photos or sync between your devices. Safari clearing website data or removing the app can erase this data. **Download backups regularly** and save them to iCloud Drive.

For automatic iPhone ↔ iPad sync, an expansion can use **Supabase Auth + Postgres + Storage**, with private user-scoped storage policies. Never embed an administrator token or GitHub personal access token in a public website.

### Data model

- `data/species.json` = shared species catalogue (published through GitHub).
- IndexedDB `catalog` = additional CSV-imported species on that device.
- IndexedDB `finds` = one discovery record per species, including date/place/notes.
- IndexedDB `photos` = one or more compressed JPEG images per species.

## Photo note

Modern iOS Safari may be able to decode HEIC, but browser support varies; JPG and PNG are more reliably processed. Photographs can be large, so on-device storage quotas apply. Browser-based backups containing many images may become very large.

## Safety

**This is a collector's diary, not a mushroom-identification or edibility guide.** A photograph cannot establish edibility. Never consume a wild mushroom based on app content or an image match. Distinguishing some fungi requires microscopy, multiple views, ecological information, and a specialist's expertise.

## Improvements for future versions

- Cloud account and automatic cross-device photo/sighting sync.
- Multiple sightings per species, including map coordinates, with privacy controls for sensitive sites.
- References and validated species identification workflow.
- Achievement badges, seasonal field journal, map of finds, location-aware recommendations.
- Optional read-only reference photos obtained with correct licences and attribution.