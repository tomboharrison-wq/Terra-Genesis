# GitHub Pages deployment

The repository deploys from GitHub Actions using `.github/workflows/pages.yml`.

One-time repository setup:

1. Open **Settings → Pages** on the GitHub repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Deploy Terra Genesis to GitHub Pages** from the Actions tab.

The workflow runs `npm ci`, `npm run build`, uploads `dist/`, and deploys it with the Pages environment. Vite is configured with `base: './'`, so the built app works under the repository Pages path as well as a custom domain.
