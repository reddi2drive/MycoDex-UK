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


## Share one collection with Kerry (separate sign-ins)

MycoDex supports **one shared collection** with **separate Supabase email logins**. Both participants can add finds, photographs, dates, places and notes. A collector does **not** get access to the other person's Supabase Dashboard or GitHub repository.

**One-time database migration (required):**

1. In the existing **MycoDex-UK** Supabase project, open **SQL Editor → New query**.
2. Open `supabase-sharing.sql` in this repository, copy the **whole file** and **Run** it. Do **not** run it in Spelling Steps.
3. Keep the existing Supabase Project URL and publishable key in `cloud-config.js`; do not add any secret/service-role keys.

**Invite your co-collector:**

1. Open MycoDex and sign in using your own email through **Data & backup → Cloud sync**. Wait for **Cloud up to date**.
2. In the same settings screen, find **Collect together**.
3. Enter Kerry's exact email address and press **Share this collection**.
4. Kerry opens the MycoDex website on her own device and signs in using **her** email (the email you entered). Her first sign-in link proves she controls that email address.
5. Kerry chooses **Sync now**, or waits for automatic synchronisation. Both users should now see the same collection; changes made while the app is open sync about once a minute, or sooner when saved.

**Notes:** The invitation grants edit access. The owner can later remove it using **Remove**, preventing future cloud access; that cannot erase copies previously downloaded to Kerry's device. Local/browser storage is not a separate security boundary. Keep a backup until you have seen **Cloud up to date**, particularly if a device already holds an independent collection.

**If sharing isn't available:** Run the migration file first, confirm both people used the **exact** invited email address, and use **Sync now**. If the app reports a local collection belonging to another account, export a backup before switching; do not wipe browser data as a troubleshooting shortcut.

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

## Cloud sync setup (Supabase) — v1.1

The app now has an **optional Supabase sync integration**. Without configuration it remains
fully usable locally, with reliable **Save as found**, immediately refreshed counters,
and backup/restore. Existing IndexedDB finds are preserved when cloud sync is enabled.

**1. Create a separate Supabase project for MycoDex** (you can reuse your Supabase account).
Open the project **SQL Editor**, paste all of [`supabase-setup.sql`](supabase-setup.sql),
and run it. The SQL creates `mycodex_finds`, `mycodex_photos`, a **private** `mycodex-photos`
Storage bucket, and per-user RLS access policies.

**2. Configure Auth → URL Configuration.** Set the Site URL to your published address,
`https://reddi2drive.github.io/MycoDex-UK/`, and add that exact URL under redirect URLs.
In **Authentication → Providers → Email**, leave email sign-in / magic-link OTP enabled.
The login sends a link to your email. Open it on the device you are signing in on.

**3. Configure the public website.** In **Project Settings / Connect / API keys**
find the **Project URL** (`https://<project-ref>.supabase.co`) and **publishable key**
(`sb_publishable_…`) or legacy `anon` key. Edit `cloud-config.js` in GitHub:

```js
window.MYCODEX_SUPABASE = {
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'YOUR-SUPABASE-PUBLISHABLE-KEY'
};
```

These two values are designed to be public: RLS protects access after login.
**Never publish the service_role key, a secret API key, database password,
or any administrator credentials.**

**4. Visit MycoDex and open Data & backup → Cloud sync**. Sign in with the same email
on both iPhone and iPad. The first sync imports existing finds and pictures from the
current device. Later edits are stored locally first and automatically retried when
connectivity returns. Cloud sync status appears at the top and in Data & backup.

**5. Make a backup first.** Before configuring or changing accounts, use
**Data & backup → Download backup** and save the JSON to iCloud Drive. Reusing
one device with different email accounts isn't supported: MycoDex blocks an
attempt to merge records belonging to a previously linked account.

### Current sync behaviour

- Found/unfound species, date, location, notes and photographs sync across signed-in devices.
- Found/unfound and photo deletions are retained as tombstones to propagate removals.
- Latest `updated_at` wins if the same species is edited on two devices.
- Photos live in private Supabase Storage (not the public GitHub repository).
- Saves and the dashboard work without Supabase connectivity; sync status states when
  data has not yet reached the cloud.
- This is **not** a verified production migration until you've run the SQL, filled the
  public configuration, and checked a real iPhone ↔ iPad sync.