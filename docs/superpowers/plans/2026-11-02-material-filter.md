# Shared material filter implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. No commits or publication: the user explicitly authorizes local edits only.

**Goal:** One content analysis drives availability, outgoing AI constraints and actual sheet contents; supported selected sentences must not silently disappear.
**Architecture:** Pure cached material analysis uses the same checkText token rules on words, complete sentence witnesses and whole authored stories. UI and prompt consume it; generation and AI import use its verified fallback material.
**Tech Stack:** existing TypeScript, Vite, Vitest, Playwright.
**Spec:** user's 2026-11-02 request: filter before sending, create selected available tasks, preserve local-only workflow.

## Constraints and review focus
- Never add an unlearned letter or combination. Ei differs from E + I.
- No numeric letter-count cutoff; finite sentence examples establish availability, not a random trial.
- Lisa las alles. is valid for L S A E I; present-only was an unjustified restriction.
- Keep parent block choices. Report use of local fallbacks explicitly.
- Missing local story is a library limitation, not proof that no story can exist.
- No external chat sending, commit, push, upload, or user-data changes.

## Tasks
- [x] Add failing regression cases for L S A E I and a missing-sentences AI answer.
- [x] Extract pure syllable helper; add cached material analysis and shared child-word seeds, sentence witnesses and readable-story witnesses.
- [x] Wire availability, outgoing closed vocabulary and examples, generator, incoming fallback and clear UI status.
- [x] Verify targeted and full tests, both builds and screenshots; review final diff.

## Rulings
- Story availability means at least one complete matching local authored story. UI wording states local-library scope.
- Incoming validation remains necessary because an external chat cannot run our validator. It never licenses an invalid word.

- Ruling: learned vowel combinations and legal consonant onsets in syllables must not depend on newLetter; newLetter prioritizes existing possibilities, never gates them.
- Review follow-up: story titles use the full incoming validator; structurally valid empty JSON is accepted before checking actual readable content; start hint uses material availability rather than letter count.

## Verification
- Regression cases were observed failing before implementation.
- Final full run: 26 test files, 503 tests passed.
- npm run build: successful; npm run android (build:play and Capacitor sync): successful.
- Browser tested L S A E I from start hint through generated prompt to an imported words-only AI answer: Sätze appeared and local supplementation was named. A4 PDF was one page; screenshot visually inspected.
- Read-only fresh review found four functional edge cases; each fixed and covered by regression tests.
- No external AI request was sent; no commits, push, or Play upload occurred. Installed-device behavior was not tested.
