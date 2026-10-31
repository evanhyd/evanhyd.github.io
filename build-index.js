const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(__dirname, 'articles.json');

function extractFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = content.match(frontmatterRegex);
  const metadata = {};
  let body = content;

  if (match) {
    const rawYaml = match[1];
    body = content.slice(match[0].length);
    rawYaml.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim();
        let val = line.slice(colonIndex + 1).trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          val = val.replace(/^['"]|['"]$/g, '');
        }
        metadata[key] = val;
      }
    });
  }

  return { metadata, body };
}

function getAllMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function parseMarkdownArticle(filePath) {
  const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const { metadata, body } = extractFrontmatter(content);

  const parsedPath = path.parse(filePath);
  // If named README.md inside a folder, use parent folder name as slug; else filename without .md
  let slug = parsedPath.name.toLowerCase() === 'readme'
    ? path.basename(parsedPath.dir)
    : parsedPath.name;
  
  if (!slug || slug === 'articles') {
    slug = parsedPath.name;
  }

  // 1. Title fallback: first '# Heading'
  let title = metadata.title;
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    title = headingMatch ? headingMatch[1].trim() : slug.replace(/[-_]/g, ' ');
  }

  // 2. Summary fallback: first paragraph of non-heading, non-image text
  let summary = metadata.summary || metadata.description;
  if (!summary) {
    const cleanLines = body
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('!') && !l.startsWith('```') && !l.startsWith('>') && !l.startsWith('---'));
    if (cleanLines.length > 0) {
      summary = cleanLines[0].slice(0, 180) + (cleanLines[0].length > 180 ? '...' : '');
    } else {
      summary = 'Notes and walkthrough for ' + title;
    }
  }

  // 3. Date fallback: file modified time
  let date = metadata.date;
  if (!date) {
    const stat = fs.statSync(filePath);
    date = stat.mtime.toISOString().split('T')[0];
  }

  // 4. Tags normalization
  let rawTags = metadata.tags || [];
  if (!Array.isArray(rawTags)) rawTags = [rawTags];
  
  const tagMapping = {
    'modern c++': 'C++',
    'cpp': 'C++',
    'c++': 'C++',
    'software development': 'Software Engineering',
    'software-development': 'Software Engineering',
    'software engineering': 'Software Engineering',
    'software-engineering': 'Software Engineering',
    'gaming': 'Video Games',
    'video game': 'Video Games',
    'video games': 'Video Games',
    'midterm': 'School',
    'school': 'School',
    'finance': 'Finance',
    'algorithms': 'Algorithms',
    'algorithm': 'Algorithms',
    'go': 'Go',
    'go-programming': 'Go'
  };

  const ignoredTags = new Set(['memes', 'meme', 'humor', 'general', 'notes', 'personal', 'food', 'review', 'templates']);

  let cleanTags = [];
  rawTags.forEach(t => {
    const lower = t.toLowerCase().trim();
    if (ignoredTags.has(lower)) return;
    cleanTags.push(tagMapping[lower] || t.trim());
  });

  if (cleanTags.length === 0) {
    if (/\b(c\+\+|cpp)\b/i.test(content)) cleanTags.push('C++');
    if (/\b(go|golang)\b/i.test(content)) cleanTags.push('Go');
    if (/\b(algorithm|tree|heap|graph|sorting)\b/i.test(content)) cleanTags.push('Algorithms');
    cleanTags.push('Software Engineering');
  }

  const tags = Array.from(new Set(cleanTags));

  // 5. Reading time
  const words = body.trim().split(/\s+/).length;
  const readingTime = `${Math.max(1, Math.ceil(words / 200))} min read`;

  return {
    slug,
    title,
    summary,
    date,
    tags,
    readingTime,
    file: relPath
  };
}

function buildIndex() {
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  const files = getAllMarkdownFiles(articlesDir);
  const articles = files.map(file => parseMarkdownArticle(file));

  // Sort newest first
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2), 'utf-8');
  console.log(`Successfully indexed ${articles.length} articles into articles.json`);
}

buildIndex();
