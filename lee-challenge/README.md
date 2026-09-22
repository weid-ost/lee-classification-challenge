# Leading Edge Erosion Classification Challenge

Open-source, GitHub-Pages-compatible research prototype for comparing three ways of classifying wind-turbine rotor-blade leading edge erosion:

1. IEA Wind Task 46 erosion classification (criteria assessed separately)
2. LERCat categories A–E
3. A participant-defined scheme with arbitrary criteria and severity levels

Participants enter name, organisation, email, organisation type and country, define their own scheme, then assess 30 image views. Participants cannot read submitted results. A researcher-only dashboard can export participants and raw event data as CSV.

## Architecture

The frontend is plain HTML/CSS/JavaScript, so it can be hosted directly on **GitHub Pages**. Private result storage and researcher authentication use **Supabase**. This separation is necessary: GitHub Pages is static hosting and cannot securely keep study submissions private by itself.

The app also runs without Supabase in browser-only demo mode; answers remain in localStorage, but there is no central researcher dataset in that mode.

## Deploy to GitHub Pages

1. Create a repository, e.g. `lee-classification-challenge`, under your GitHub account/organisation.
2. Copy these files to the repository and push them.
3. In GitHub: **Settings → Pages → Deploy from a branch → main / root**.
4. Your participant URL will be `https://<account>.github.io/lee-classification-challenge/` and the researcher page `/admin.html`.

## Configure private data collection

1. Create a Supabase project.
2. Open the SQL editor and run `supabase.sql`.
3. In Supabase Authentication, create the researcher user.
4. Copy that user's UUID and run: `insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');`
5. Put the project URL and **anon/public** key in `config.js`. Never put the service-role key in GitHub.
6. Commit and redeploy.

The supplied row-level-security rules allow anonymous participants to INSERT, but not SELECT. Only authenticated users whose UUID is in `admin_users` can read participant details and results.

## Data model

`participants` stores registration details. `events` is append-only and stores the participant's custom scheme, each completed image assessment, and final submission. Append-only writes make autosave/submission possible without giving anonymous clients permission to read or update research data.

## Dashboard record management

The researcher dashboard can reversibly hide an entry from its normal view or permanently delete the participant and all linked events. Existing Supabase projects must first run `supabase-migration-admin-controls.sql` once in the Supabase SQL Editor. Hidden entries remain available through the dashboard's visibility filter and can be restored. Permanent deletion cannot be undone.

## Important prototype limitations

- The current 30 cases are **30 cropped/zoomed assessment views derived from four openly available source images**, not 30 independent inspection cases. They are suitable for testing workflow, not for drawing scientific conclusions. See `ATTRIBUTION.md`.
- Several IEA Task 46 criteria (especially mass loss and aerodynamic performance) cannot normally be inferred from a photograph alone. The UI therefore includes **Cannot determine from image** rather than forcing a false estimate.
- Before public recruitment, add your ethics/consent/privacy wording, retention policy, contact details, and a bot/spam control (e.g. an Edge Function plus CAPTCHA/Turnstile).
- Review the exact classification wording and study protocol with the research team before freezing the challenge.
- For a formal study, version the image set and protocol and do not change them after recruitment begins.

## Replacing images

Edit `data/images.js`. Each image object needs a stable `id`, `url`, source/license metadata, and optional crop settings. For a final challenge, use 30 independent rights-cleared images and set zoom to 1 unless a pre-defined crop is part of the protocol.

## Local testing

Run a simple static server in the folder, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## License

Code: MIT License. Image assets remain under their respective source licenses; see `ATTRIBUTION.md`.
