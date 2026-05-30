#!/usr/bin/env node
/**
 * Convert Markdown files to PDF via HTML conversion
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';

// Simple markdown to HTML converter
function markdownToHTML(markdown) {
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', Arial, sans-serif; line-height: 1.6; max-width: 8.5in; margin: 0 auto; padding: 20px; }
    h1 { font-size: 24pt; margin-top: 20px; margin-bottom: 10px; }
    h2 { font-size: 18pt; margin-top: 15px; margin-bottom: 8px; }
    h3 { font-size: 14pt; margin-top: 12px; margin-bottom: 6px; }
    p { margin-bottom: 10px; text-align: justify; }
    code { background: #f5f5f5; padding: 2px 4px; font-family: monospace; }
    ul { margin-left: 20px; }
    li { margin-bottom: 6px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

async function convertMDtoPDF(mdFile) {
  const mdPath = path.join(projectDir, mdFile);
  const pdfPath = path.join(projectDir, mdFile.replace('.md', '.pdf'));

  if (!fs.existsSync(mdPath)) {
    console.log(`❌ File not found: ${mdPath}`);
    return false;
  }

  console.log(`📄 Converting: ${mdFile}`);

  const markdown = fs.readFileSync(mdPath, 'utf-8');
  const html = markdownToHTML(markdown);

  const tempHtml = path.join(projectDir, `.temp_${mdFile.replace('.md', '.html')}`);
  fs.writeFileSync(tempHtml, html);

  return new Promise((resolve) => {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    const args = [
      `--headless=new`,
      `--disable-gpu`,
      `--print-to-pdf=${pdfPath}`,
      `--print-to-pdf-no-header`,
      `file://${tempHtml}`
    ];

    const chrome = spawn(chromePath, args, { stdio: 'pipe' });

    let timeout = setTimeout(() => {
      chrome.kill();
      if (fs.existsSync(pdfPath)) {
        console.log(`   ✅ Created: ${pdfPath}`);
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
        resolve(true);
      } else {
        console.log(`   ⚠️  Failed to create: ${pdfPath}`);
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
        resolve(false);
      }
    }, 8000);

    chrome.on('close', (code) => {
      clearTimeout(timeout);
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000) {
        console.log(`   ✅ Created: ${pdfPath}`);
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
        resolve(true);
      } else {
        console.log(`   ⚠️  Failed to create: ${pdfPath}`);
        if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
        resolve(false);
      }
    });

    chrome.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`   ⚠️  Chrome error: ${err.message}`);
      if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n🔄 Converting markdown documents to PDF...\n');

  const files = [
    'PROVISIONAL_PATENT_INDIA.md',
    'PATENT_FILING_GUIDE_CHECKLIST.md',
    'README_PATENT_FILING_PACKAGE.md'
  ];

  let successCount = 0;
  for (const file of files) {
    const success = await convertMDtoPDF(file);
    if (success) successCount++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Conversion complete: ${successCount}/${files.length} files`);
  console.log(`📁 Files saved to: ${projectDir}\n`);

  // List created PDF files
  console.log('📋 Created PDF files:');
  for (const file of files) {
    const pdfFile = file.replace('.md', '.pdf');
    const pdfPath = path.join(projectDir, pdfFile);
    if (fs.existsSync(pdfPath)) {
      const sizeKb = (fs.statSync(pdfPath).size / 1024).toFixed(1);
      console.log(`   ✅ ${pdfFile} (${sizeKb} KB)`);
    } else {
      console.log(`   ❌ ${pdfFile} (not created)`);
    }
  }
}

main().catch(console.error);
