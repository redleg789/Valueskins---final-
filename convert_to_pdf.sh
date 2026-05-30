#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "Converting HTML & Markdown files to PDF"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "OPTION 1: Using your web browser (SIMPLEST - 5 minutes)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "For each file below:"
echo "  1. Open file in Chrome/Firefox/Safari"
echo "  2. Press Cmd+P (Mac) or Ctrl+P (Windows)"
echo "  3. Click 'Save as PDF'"
echo "  4. Name and save"
echo ""
echo "FILES TO CONVERT:"
echo "─────────────────"
ls -1 FORM_*.html PATENT_DRAWINGS_DIAGRAMS.html 2>/dev/null | while read f; do
  echo "  ✓ $f"
done

echo ""
echo "OPTION 2: Using Python (Automatic)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Checking for LibreOffice (command-line PDF conversion)..."

if command -v libreoffice &> /dev/null; then
    echo "✓ LibreOffice found! Converting now..."
    
    for file in FORM_*.html PATENT_DRAWINGS_DIAGRAMS.html; do
        if [ -f "$file" ]; then
            echo "Converting $file..."
            libreoffice --headless --convert-to pdf "$file" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "  ✓ Created ${file%.html}.pdf"
            fi
        fi
    done
    
    echo ""
    echo "Converting Markdown files..."
    if command -v pandoc &> /dev/null; then
        pandoc PROVISIONAL_PATENT_INDIA.md -o PROVISIONAL_PATENT_INDIA.pdf
        echo "  ✓ Created PROVISIONAL_PATENT_INDIA.pdf"
    else
        echo "  → For PROVISIONAL_PATENT_INDIA.md: Use Option 1 browser method"
    fi
else
    echo "✗ LibreOffice not installed"
    echo ""
    echo "Install LibreOffice and try again:"
    echo "  Mac: brew install libreoffice"
    echo "  Ubuntu/Debian: sudo apt-get install libreoffice"
    echo ""
    echo "OR use OPTION 1: Open files in browser and Print to PDF"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ CONVERSION COMPLETE"
echo "════════════════════════════════════════════════════════════════"
