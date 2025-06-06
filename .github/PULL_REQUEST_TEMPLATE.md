## Description

Please include a summary of the change and which issue is fixed.  
Reference any related issues using `#1234` notation.

**What is the problem this PR is solving?**

<!--- Describe the problem or feature request in detail. -->

**How did you solve it?**

<!--- Explain the approach and the reasoning behind your solution. -->

## Related Issue

Add Jira issue link here.

## Type of Change

Please delete options that are not relevant.

- 🐛 Bug fix (non-breaking change which fixes an issue)
- ✨ New feature (non-breaking change which adds functionality)
- 🔄 Refactor (non-breaking change that improves code structure/quality)
- 📖 Documentation update
- 🚀 Performance improvement
- ✅ Test addition or enhancement
- 🧹 Chore (build process, CI, tooling, etc)

## Which Workspace(s) Does This Affect?

_Select all that apply_:

- [ ] `frontend`
- [ ] `backend`
- [ ] `crawler`
- [ ] `bin` / CLI
- [ ] `newsletters`
- [ ] `.github` / GitHub Actions
- [ ] `shell` / scripts
- [ ] Root / tooling
- [ ] Other (please specify)

## Checklist

Please verify the following before requesting review:

- [ ] I have read the **contributing guidelines**.
- [ ] My code follows the existing **style guide** (lint, formatting).
- [ ] I have added or updated **unit tests** for new functionality.
- [ ] I have added or updated **end-to-end tests** where applicable.
- [ ] I have added or updated **documentation** (in-code comments, README, PR template).
- [ ] I have run the full **test suite** locally (`npm test`, `npm run test:e2e`).
- [ ] I have tested my changes in **development** and **production** builds.
- [ ] Any dependent changes have been merged and published in downstream modules.

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce:

```bash
# Example:
npm ci
npm run build
# run unit tests
npm run test
# run frontend E2E
npm --workspace frontend run test:e2e
# run crawler smoke
npm --workspace crawler run crawl
```

- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Manual testing steps (please describe)

## Screenshots (if appropriate)

<!-- Attach screenshots or animated GIFs to help reviewers understand UI changes. -->

## Deployment Notes

- Does this require new environment variables?

  - [ ] Yes — documented below
  - [ ] No

If yes, list and describe:

```text
ENV_VAR_NAME=description
```

## Rollback Plan

If something goes wrong, what is the rollback strategy?

---

Thank you for your contribution! 🎉
Please ensure all checks pass before merging.
