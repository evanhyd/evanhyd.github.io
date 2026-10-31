import os
import re

articles_dir = r'C:\Users\evanh\Desktop\evanhyd.github.io\articles'

for fname in os.listdir(articles_dir):
    if not fname.endswith('.md'):
        continue
    fpath = os.path.join(articles_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace nbsp
    content = content.replace('\xa0', ' ')

    # If the file has a title, check for duplicate heading immediately following frontmatter
    fm_match = re.match(r'^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$', content)
    if fm_match:
        fm, body = fm_match.group(1), fm_match.group(2)
        title_match = re.search(r'title:\s*["\']?(.*?)["\']?\s*$', fm, flags=re.MULTILINE)
        title = title_match.group(1).strip() if title_match else ''
        
        # Check first non-empty line of body
        body_lines = body.split('\n')
        idx = 0
        while idx < len(body_lines) and not body_lines[idx].strip():
            idx += 1
            
        if idx < len(body_lines):
            line = body_lines[idx].strip()
            # If line is a heading and contains a big chunk of title
            if line.startswith('#'):
                norm_heading = re.sub(r'[^a-z0-9]+', '', line.lower())
                norm_title = re.sub(r'[^a-z0-9]+', '', title.lower())
                if norm_heading == norm_title or norm_title.startswith(norm_heading) or norm_heading.startswith(norm_title):
                    body_lines.pop(idx)
                    body = '\n'.join(body_lines)

        content = f'---\n{fm}\n---\n{body}'

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print('Sanitized all articles successfully.')
