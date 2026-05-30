const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';

const files = [
  'FORM_1A_EXAM_REQUEST.html',
  'FORM_3_DECLARATION_INVENTORSHIP.html',
  'FORM_5_FULL_PATENT_APPLICATION.html',
  'PATENT_DRAWINGS_DIAGRAMS.html',
];

async function convertWithTimeout(file) {
  const htmlPath = path.join(projectDir, file);
  const pdfPath = path.join(projectDir, file.replace('.html', '.pdf'));
  
  console.log(`Converting: ${file}`);
  
  try {
    const cmd = `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --headless=new --disable-gpu --print-to-pdf=${pdfPath} --print-to-pdf-no-header file://${htmlPath}`;
    
    execSync(cmd, { timeout: 10000, stdio: 'ignore' });
    
    // Give it a moment to write the file
    await new Promise(r => setTimeout(r, 1000));
    
    if (fs.existsSync(pdfPath)) {
      const size = fs.statSync(pdfPath).size;
      console.log(`✅ Created: ${file.replace('.html', '.pdf')} (${(size/1024).toFixed(1)} KB)`);
      return true;
    }
  } catch (e) {
    // Ignore timeout - Chrome might still write the file
    await new Promise(r => setTimeout(r, 1000));
    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 100) {
      const size = fs.statSync(pdfPath).size;
      console.log(`✅ Created: ${file.replace('.html', '.pdf')} (${(size/1024).toFixed(1)} KB)`);
      return true;
    }
  }
  
  console.log(`❌ Failed: ${file}`);
  return false;
}

async function main() {
  console.log('Converting HTML files to PDF...\n');
  
  for (const file of files) {
    await convertWithTimeout(file);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n✅ Done!');
}

main();
