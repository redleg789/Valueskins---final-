const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';
const sourceHtml = path.join(projectDir, 'PATENT_DRAWINGS_DIAGRAMS.html');
const tempHtml = path.join(projectDir, '.temp_PATENT_DRAWINGS_DIAGRAMS_SUBMISSION.html');
const outputPdf = path.join(projectDir, 'PATENT_DRAWINGS_DIAGRAMS_SUBMISSION.pdf');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function buildSubmissionHtml() {
  let html = fs.readFileSync(sourceHtml, 'utf8');

  // Remove the decorative cover page for a cleaner filing packet.
  html = html.replace(/<div class="cover-page">[\s\S]*?<\/div>\s*/i, '');

  // Replace the existing style block with print-focused filing CSS.
  html = html.replace(
    /<style>[\s\S]*?<\/style>/i,
    `<style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        @page {
            size: A4 landscape;
            margin-top: 4cm;
            margin-right: 3cm;
            margin-bottom: 3cm;
            margin-left: 4cm;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            background: white;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .container {
            width: 100%;
            max-width: none;
            margin: 0;
        }
        .figure {
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
            width: 100%;
        }
        .figure:last-of-type {
            break-after: auto;
            page-break-after: auto;
        }
        .fig-title {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 10pt 0;
            padding: 0;
            background: none;
            border: none;
        }
        .figure svg {
            width: 100%;
            max-width: 100%;
            max-height: 9.2cm;
            height: auto;
            border: 1px solid #000;
            display: block;
            margin: 0 auto 10pt auto;
        }
        .figure-description {
            font-size: 8.5pt;
            line-height: 1.35;
            padding: 8pt;
            background: none;
            border: 1px solid #000;
        }
        .page-break {
            display: none;
        }
    </style>`
  );

  return html;
}

function runChromePrint() {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--print-to-pdf=${outputPdf}`,
      '--print-to-pdf-no-header',
      `file://${tempHtml}`,
    ];

    const chrome = spawn(chromePath, args, { stdio: 'pipe' });
    let stderr = '';

    chrome.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    chrome.on('error', reject);

    chrome.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPdf) && fs.statSync(outputPdf).size > 1000) {
        resolve();
        return;
      }
      reject(new Error(stderr || `Chrome exited with code ${code}`));
    });
  });
}

async function main() {
  fs.writeFileSync(tempHtml, buildSubmissionHtml());

  try {
    await runChromePrint();
    const sizeMb = (fs.statSync(outputPdf).size / (1024 * 1024)).toFixed(2);
    console.log(outputPdf);
    console.log(`size_mb=${sizeMb}`);
  } finally {
    if (fs.existsSync(tempHtml)) {
      fs.unlinkSync(tempHtml);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
