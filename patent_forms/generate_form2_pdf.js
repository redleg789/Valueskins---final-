#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';
const mdFile = 'FORM_2_PROVISIONAL_SPEC.md';
const mdPath = path.join(projectDir, mdFile);
const pdfPath = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.pdf');
const tempHtml = path.join(projectDir, '.temp_FORM_2_PROVISIONAL_SPEC.html');
function markdownToHTML(markdown) {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = escaped
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n+/g, '</p><p>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Form 2 Provisional Specification</title>
  <style>
    @page {
      size: A4;
      margin: 2.54cm;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #000;
      line-height: 1.45;
      font-size: 11pt;
    }
    h1, h2, h3, h4 {
      page-break-after: avoid;
      margin-top: 18pt;
      margin-bottom: 8pt;
    }
    h1 { font-size: 18pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
    h4 { font-size: 11pt; }
    p {
      margin: 0 0 10pt 0;
      text-align: justify;
    }
    ul {
      margin: 0 0 10pt 22pt;
    }
    li {
      margin-bottom: 4pt;
    }
    code {
      font-family: "Courier New", monospace;
      font-size: 9.5pt;
      background: #f4f4f4;
      padding: 1pt 3pt;
    }
    pre {
      white-space: pre-wrap;
      font-family: "Courier New", monospace;
      font-size: 9.5pt;
      border: 1px solid #999;
      padding: 8pt;
      margin: 10pt 0;
    }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
}

async function run() {
  if (!fs.existsSync(mdPath)) {
    throw new Error(`Missing file: ${mdPath}`);
  }

  const markdown = fs.readFileSync(mdPath, 'utf8');
  fs.writeFileSync(tempHtml, markdownToHTML(markdown));

  const result = spawnSync(
    '/usr/sbin/cupsfilter',
    ['-m', 'application/pdf', tempHtml],
    { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }
  );

  if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);

  if (result.status !== 0 || !result.stdout || result.stdout.length < 1000) {
    throw new Error(result.stderr?.toString() || 'cupsfilter did not produce a valid PDF');
  }

  fs.writeFileSync(pdfPath, result.stdout);
  console.log(pdfPath);
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
