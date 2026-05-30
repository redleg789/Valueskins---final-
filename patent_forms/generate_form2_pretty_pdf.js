#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';
const sourceMd = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.md');
const outputHtml = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.html');
const outputPdf = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.pdf');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const out = [];
  let paragraph = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  function flushCode() {
    if (!inCode) return;
    out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    inCode = false;
    codeLines = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushParagraph();
      closeLists();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeLists();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      closeLists();
      out.push('<hr>');
      continue;
    }

    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      flushParagraph();
      closeLists();
      out.push(`<h1>${inlineFormat(h1[1])}</h1>`);
      continue;
    }

    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      flushParagraph();
      closeLists();
      out.push(`<h2>${inlineFormat(h2[1])}</h2>`);
      continue;
    }

    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      flushParagraph();
      closeLists();
      out.push(`<h3>${inlineFormat(h3[1])}</h3>`);
      continue;
    }

    const h4 = line.match(/^#### (.+)$/);
    if (h4) {
      flushParagraph();
      closeLists();
      out.push(`<h4>${inlineFormat(h4[1])}</h4>`);
      continue;
    }

    const ol = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(ol[2])}</li>`);
      continue;
    }

    const ul = line.match(/^\s*-\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeLists();
  flushCode();

  return out.join('\n');
}

function buildHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form 2 - Provisional Specification</title>
  <style>
    @page {
      size: A4;
      margin: 2.8cm 2.2cm 2.5cm 2.8cm;
    }

    :root {
      --ink: #111;
      --muted: #555;
      --rule: #b8b8b8;
      --accent: #1f1f1f;
      --paper: #ffffff;
      --wash: #f6f4ef;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      background: var(--paper);
      color: var(--ink);
      margin: 0;
      padding: 0;
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 11.5pt;
      line-height: 1.55;
    }

    body {
      padding: 0;
    }

    .document {
      max-width: 100%;
      margin: 0 auto;
    }

    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
      color: var(--accent);
    }

    h1 {
      font-size: 21pt;
      line-height: 1.2;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin: 0 0 0.35cm 0;
    }

    h2 {
      font-size: 14pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin: 0.9cm 0 0.25cm 0;
      padding-top: 0.15cm;
      border-top: 1px solid var(--rule);
    }

    h3 {
      font-size: 12.5pt;
      margin: 0.55cm 0 0.18cm 0;
    }

    h4 {
      font-size: 11.5pt;
      font-style: italic;
      margin: 0.45cm 0 0.14cm 0;
    }

    p {
      margin: 0 0 0.28cm 0;
      text-align: justify;
    }

    strong {
      font-weight: 700;
    }

    hr {
      border: 0;
      border-top: 1px solid var(--rule);
      margin: 0.45cm 0;
    }

    ol, ul {
      margin: 0.2cm 0 0.35cm 0.75cm;
      padding: 0;
    }

    li {
      margin: 0 0 0.14cm 0;
      padding-left: 0.08cm;
    }

    code {
      font-family: "SFMono-Regular", "Menlo", "Courier New", monospace;
      font-size: 9.6pt;
      background: var(--wash);
      border: 1px solid #e5e0d6;
      border-radius: 3px;
      padding: 0.02cm 0.12cm;
    }

    pre {
      font-family: "SFMono-Regular", "Menlo", "Courier New", monospace;
      font-size: 9.2pt;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: #fbfaf7;
      border: 1px solid #d8d2c6;
      padding: 0.35cm;
      margin: 0.25cm 0 0.45cm 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .subtitle {
      text-align: center;
      font-size: 11pt;
      color: var(--muted);
      margin-bottom: 0.4cm;
    }

    .title-block {
      border: 1.5px solid var(--ink);
      padding: 0.55cm 0.6cm;
      margin-bottom: 0.55cm;
    }

    .title-block p {
      text-align: center;
      margin: 0.12cm 0;
    }

    @media print {
      a, a:visited {
        color: inherit;
        text-decoration: none;
      }
    }
  </style>
</head>
<body>
  <main class="document">
    ${body
      .replace(
        /<h1>([\s\S]*?)<\/h1>\s*<h2>([\s\S]*?)<\/h2>/,
        `<section class="title-block"><h1>$1</h1><p class="subtitle">$2</p></section>`
      )}
  </main>
</body>
</html>`;
}

async function writePdfFromHtml(htmlPath, pdfPath) {
  if (fs.existsSync(pdfPath)) {
    fs.unlinkSync(pdfPath);
  }

  await new Promise((resolve, reject) => {
    const chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        `--print-to-pdf=${pdfPath}`,
        '--print-to-pdf-no-header',
        `file://${htmlPath}`,
      ],
      { stdio: 'ignore' }
    );

    let settled = false;
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      if (ok) resolve();
      else reject(error);
    };

    const poll = setInterval(() => {
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 2000) {
        finish(true);
      }
    }, 500);

    const timeout = setTimeout(() => {
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 2000) {
        finish(true);
      } else {
        try { chrome.kill(); } catch (_) {}
        finish(false, new Error('Failed to generate a readable Form 2 PDF.'));
      }
    }, 20000);

    chrome.on('error', (error) => finish(false, error));
    chrome.on('close', () => {
      setTimeout(() => {
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 2000) {
          finish(true);
        }
      }, 800);
    });
  });
}

async function main() {
  const markdown = fs.readFileSync(sourceMd, 'utf8');
  const htmlBody = markdownToHtml(markdown);
  const fullHtml = buildHtml(htmlBody);
  fs.writeFileSync(outputHtml, fullHtml, 'utf8');
  await writePdfFromHtml(outputHtml, outputPdf);
  console.log(outputPdf);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
