import re
with open('src/lib/docx/builder.ts', 'r') as f:
    content = f.read()

# Replace block 2: if (!isKuliah) { D. Analisis Hasil ... } else { BAB III KESIMPULAN ... }
pattern2 = re.compile(r'if \(!isKuliah\) \{(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_2,\s*children: \[new TextRun\(\{ text: \'D\. Analisis Hasil\'.*?)\} else \{(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*alignment: AlignmentType\.CENTER,\s*children: \[\s*new TextRun\(\{ text: \'BAB III\'.*?)\}', re.DOTALL)

def repl2(match):
    return 'if (!isKuliah && !isResume) {' + match.group(1) + '} else if (isKuliah) {' + match.group(2) + '}' + ''' else if (isResume) {
    let kesimpulanImageIndex = 1;
    const { elements } = await renderCAnalysis(cAnalysis, 'II', kesimpulanImageIndex);
    bodyChildren.push(...elements);
  }'''

content = pattern2.sub(repl2, content)

# Replace block 3: if (!isKuliah) { III. Post Test ...
pattern3 = re.compile(r'if \(!isKuliah\) \{(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*children: \[new TextRun\(\{ text: \'III\. Post Test\')', re.DOTALL)

def repl3(match):
    return 'if (!isKuliah && !isResume) {' + match.group(1)

content = pattern3.sub(repl3, content)

# Replace Block 4: if (!isKuliah) { C. Implementasi/Screenshot
pattern4 = re.compile(r'if \(!isKuliah\) \{(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_2,\s*children: \[new TextRun\(\{ text: \'C\. Implementasi/Screenshot\')')

def repl4(match):
    return 'if (!isKuliah && !isResume) {' + match.group(1)

content = pattern4.sub(repl4, content)

with open('src/lib/docx/builder.ts', 'w') as f:
    f.write(content)
