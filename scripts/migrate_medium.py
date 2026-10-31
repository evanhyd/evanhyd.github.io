import os
import re
import email.utils
import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup, NavigableString, Tag

articles_dir = r'C:\Users\evanh\Desktop\evanhyd.github.io\articles'

# 1. Update existing articles dates to match original commit history
existing_updates = {
    'cheese-cs-midterm.md': '2022-06-09',
    'cpp-quirks-and-memes.md': '2022-04-08',
    'competitive-programming-fast-io.md': '2022-04-05',
    'cpp-variadic-forwarding.md': '2023-07-01'
}

for fname, new_date in existing_updates.items():
    fpath = os.path.join(articles_dir, fname)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        content = re.sub(r'date:\s*\d{4}-\d{2}-\d{2}', f'date: {new_date}', content)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {fname} date to {new_date}')

# Also ensure C++BadStringConstructor meme is in cpp-quirks-and-memes.md
memes_path = os.path.join(articles_dir, 'cpp-quirks-and-memes.md')
with open(memes_path, 'r', encoding='utf-8') as f:
    memes_content = f.read()
if 'C++BadStringConstructor.PNG' not in memes_content:
    addition = '\n### 5. Brilliant std::string constructor\n[![bad std::string constructor](Image/C%2B%2BBadStringConstructor.PNG?raw=true)](https://www.youtube.com/watch?v=3MOw1a9B7kc)\n'
    memes_content += addition
    with open(memes_path, 'w', encoding='utf-8') as f:
        f.write(memes_content)
    print('Added string constructor meme to cpp-quirks-and-memes.md')

# 2. Fetch Medium RSS and convert all articles
def clean_text(text):
    if not text:
        return ''
    text = text.replace('\u200a', ' ').replace('\u200b', '').replace('\u2014', '—').replace('\u2013', '–')
    return text.strip()

def html_to_markdown(html_content, title, default_lang=''):
    soup = BeautifulSoup(html_content, 'html.parser')

    # Remove tracking pixels
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if 'stat?' in src or 'medium.com/_/stat' in src:
            img.decompose()

    def process_node(node):
        if isinstance(node, NavigableString):
            return str(node)
        if not isinstance(node, Tag):
            return ''

        tag = node.name.lower()

        if tag == 'br':
            return '\n'

        if tag == 'pre':
            for br in node.find_all('br'):
                br.replace_with('\n')
            code_text = node.get_text()
            lang = default_lang
            if 'package ' in code_text or 'func ' in code_text or 'import (' in code_text or ':= ' in code_text:
                lang = 'go'
            elif '#include' in code_text or 'std::' in code_text or 'template' in code_text or 'class ' in code_text:
                lang = 'cpp'
            return f'\n\n```{lang}\n{code_text.strip()}\n```\n\n'

        if tag == 'code':
            return f'`{node.get_text()}`'

        if tag in ['h1', 'h2', 'h3']:
            heading_text = clean_text(node.get_text())
            # Don't repeat title if it matches
            if heading_text.lower() == title.lower():
                return ''
            return f'\n\n## {heading_text}\n\n'

        if tag in ['h4', 'h5', 'h6']:
            heading_text = clean_text(node.get_text())
            return f'\n\n### {heading_text}\n\n'

        if tag == 'blockquote':
            inner = ''.join(process_node(c) for c in node.children).strip()
            lines = [f'> {line}' for line in inner.split('\n')]
            return '\n\n' + '\n'.join(lines) + '\n\n'

        if tag == 'figure':
            img = node.find('img')
            figcaption = node.find('figcaption')
            if img:
                src = img.get('src', '')
                alt = img.get('alt', '') or (figcaption.get_text().strip() if figcaption else '')
                alt = clean_text(alt)
                caption_text = f'\n*{clean_text(figcaption.get_text())}*' if figcaption else ''
                return f'\n\n![{alt}]({src}){caption_text}\n\n'

        if tag == 'p':
            inner = ''.join(process_node(c) for c in node.children).strip()
            return f'\n\n{inner}\n\n' if inner else ''

        if tag in ['strong', 'b']:
            inner = ''.join(process_node(c) for c in node.children)
            return f'**{inner}**'

        if tag in ['em', 'i']:
            inner = ''.join(process_node(c) for c in node.children)
            return f'*{inner}*'

        if tag == 'a':
            inner = ''.join(process_node(c) for c in node.children)
            href = node.get('href', '#')
            return f'[{inner}]({href})'

        if tag == 'ul':
            items = []
            for li in node.find_all('li', recursive=False):
                li_text = ''.join(process_node(c) for c in li.children).strip()
                items.append(f'- {li_text}')
            return '\n\n' + '\n'.join(items) + '\n\n'

        if tag == 'ol':
            items = []
            for idx, li in enumerate(node.find_all('li', recursive=False), 1):
                li_text = ''.join(process_node(c) for c in li.children).strip()
                items.append(f'{idx}. {li_text}')
            return '\n\n' + '\n'.join(items) + '\n\n'

        return ''.join(process_node(c) for c in node.children)

    res = process_node(soup)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()

tag_map = {
    'software-engineering': 'Software Engineering',
    'software-development': 'Software Development',
    'cpp': 'C++',
    'go-programming': 'Go',
    'computer-science': 'Computer Science',
    'gaming': 'Gaming',
    'finance': 'Finance'
}

req = urllib.request.Request('https://medium.com/feed/@unboxthecat', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    root = ET.fromstring(resp.read())

items = root.findall('.//item')
print(f'Processing {len(items)} Medium articles...')

for item in items:
    raw_title = clean_text(item.find('title').text)
    pub_date_str = item.find('pubDate').text
    pub_dt = email.utils.parsedate_to_datetime(pub_date_str)
    date_formatted = pub_dt.strftime('%Y-%m-%d')
    medium_link = item.find('link').text

    raw_categories = [c.text for c in item.findall('category') if c.text]
    mapped_tags = [tag_map.get(c, c.title()) for c in raw_categories]
    if not mapped_tags:
        if 'Chocolate' in raw_title:
            mapped_tags = ['Review', 'Food']
        elif 'Warren' in raw_title:
            mapped_tags = ['Finance']
        else:
            mapped_tags = ['General']

    # Generate slug
    slug = re.sub(r'[^a-z0-9]+', '-', raw_title.lower()).strip('-')
    if len(slug) > 60:
        slug = slug[:60].rstrip('-')

    content_el = item.find('{http://purl.org/rss/1.0/modules/content/}encoded')
    html_content = content_el.text if content_el is not None else ''

    # Default code block lang
    default_lang = 'cpp' if 'C++' in mapped_tags or 'cpp' in raw_categories else ('go' if 'Go' in mapped_tags else '')
    body_md = html_to_markdown(html_content, raw_title, default_lang)

    # First clean paragraph as summary
    paragraphs = [p.strip() for p in body_md.split('\n\n') if p.strip() and not p.strip().startswith('!') and not p.strip().startswith('#') and not p.strip().startswith('*') and not p.strip().startswith('>') and not p.strip().startswith('```')]
    summary = paragraphs[0].replace('"', '\\"') if paragraphs else f'Article about {raw_title}.'
    if len(summary) > 200:
        summary = summary[:197] + '...'

    tags_formatted = '["' + '", "'.join(mapped_tags) + '"]'
    footer_note = f'\n\n---\n*Originally published on [Medium]({medium_link}) on {pub_dt.strftime("%B %d, %Y")}.*'
    
    full_content = f'''---
title: "{raw_title}"
date: {date_formatted}
tags: {tags_formatted}
summary: "{summary}"
---

{body_md}{footer_note}
'''

    out_file = os.path.join(articles_dir, f'{slug}.md')
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(full_content)
    print(f'Saved: {slug}.md ({date_formatted})')

print('All done!')
