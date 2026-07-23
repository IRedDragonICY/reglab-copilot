import re
with open('src/lib/docx/builder.ts', 'r') as f:
    content = f.read()

# Replace block 2: if (!isKuliah) { II. Hasil Praktikum ...
pattern = re.compile(r'if \(!isKuliah\) \{(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*children: \[\s*new TextRun\(\{ text: \'II\. Hasil Praktikum\')')

def repl(match):
    return 'if (!isKuliah && !isResume) {' + match.group(1)

content = pattern.sub(repl, content)

with open('src/lib/docx/builder.ts', 'w') as f:
    f.write(content)
