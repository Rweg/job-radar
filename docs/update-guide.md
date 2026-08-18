# Job Radar Update Guide

The live dashboard is a static site backed by `data/jobs.json`. The site is intentionally jobs-only. It does not include scholarships, task platforms, passport files, transcripts, references, employer-confidential material, or application essays.

## What is sourced

Every record has:

- an employer or primary job-provider source URL;
- a direct application URL where one is available;
- `lastVerified`, `status`, `deadline`, compensation, and work-right notes;
- a fit score based on the current career profile;
- evidence to show, gaps to close, interview themes, and next actions.

`active` means the source was reachable or the public employer posting was present at the last check. `watch` means a strong target is worth monitoring but should not be treated as open. `closed` means the public source check no longer returned the posting. A source can be reachable while the actual job is closed, so read the job page before submitting.

## Automatic checks

`.github/workflows/refresh-jobs.yml` runs every six hours. It uses public Lever postings data for Waabi and Shield AI and reachability checks for other curated employer pages. It only updates source-check metadata and status; it does not rewrite the fit rationale or preparation material.

`.github/workflows/deploy-pages.yml` publishes the dashboard after changes land on `main`.

## Manual updates

1. Open the employer's current application page.
2. Confirm the title, location, work mode, eligibility, compensation, and closing date.
3. Update the relevant record in `data/jobs.json`.
4. Keep uncertainty visible. Use `unknown`, `conditional`, `watch`, or `Not published` instead of guessing.
5. Run the checks locally:

```bash
python3 -m json.tool data/jobs.json >/dev/null
python3 scripts/update_jobs.py
```

6. Commit and push the data change. GitHub Pages will redeploy automatically.

## Safe application preparation

The preparation panel is a planning aid. It is not a cover letter generator and it should not be pasted into an employer form. Rewrite everything in your own voice, verify each claim, and never disclose confidential Zipline processes, internal URLs, private metrics, customer information, code, or data.

The browser's saved jobs and notes are stored in local browser storage. They are not synchronized to GitHub and should not be used for passport numbers, referee contact details, or other high-sensitivity information.
