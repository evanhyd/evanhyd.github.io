# evanhyd.github.io

Personal tech blog, engineering digital garden, and portfolio website for **Evan Hyd**.

Hosted live on GitHub Pages at: [https://evanhyd.github.io](https://evanhyd.github.io)

---

## ✨ Features

- **Automated Article Indexing**: Simply commit and push a new Markdown file (`articles/my-post.md` or `articles/my-topic/README.md`), and GitHub Actions automatically updates the article list, reading time, tags, and deploys the site.
- **Interactive Markdown Reader**: Client-side Markdown parser with Prism.js syntax highlighting (C++, Python, Bash, etc.) and a 1-click "Copy Code" button.
- **Table of Contents (TOC)**: Auto-generated on this page sidebar for smooth jumping.
- **Reading Progress Bar**: Visual progress indicator as you scroll through long articles.
- **Search & Tag Filters**: Instant client-side search across titles, summaries, tags, and categories.
- **Modern Color Themes**: System / Dark / Light theme selector using modern CSS `light-dark()` and `:has(> head > meta[name="color-scheme"][...])`.
- **Zero-Dependency Core**: Pure HTML5, modern CSS3, and ES6 JavaScript.

---

## ✍️ How to Publish a New Article

Publishing is as simple as dropping a Markdown file into `articles/`:

### 1. Create a markdown file
Create `articles/your-article-slug.md` (or `articles/your-folder/README.md`).

### 2. (Optional) Add Frontmatter
You can add YAML frontmatter at the top:
```markdown
---
title: My New Deep Dive
date: 2026-11-01
tags: ["C++", "Performance"]
summary: Squeezing maximum speed out of memory caches.
---

# My New Deep Dive
Your article content goes here...
```
*Note: If you omit frontmatter, the automated indexer will automatically use your first `# Heading` as the title, extract the summary from the opening paragraph, and calculate reading time automatically!*

### 3. Commit and Push
```bash
git add articles/
git commit -m "Add new article: My New Deep Dive"
git push
```

The GitHub Actions workflow in `.github/workflows/deploy.yml` will automatically run `node build-index.js`, update `articles.json`, and deploy the latest build to GitHub Pages!

---

## 💻 Local Development

To run and preview the blog locally:

```bash
# Generate / update articles.json
node build-index.js

# Start local preview server (using Node or Python)
npx serve .
# or
python -m http.server 8000
```
Then visit `http://localhost:3000` or `http://localhost:8000`.
