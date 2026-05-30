#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const projectDir = '/Users/sakethvelamuri/Desktop/Startups. /Short term/Valueskins.';
const sourceMd = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.md');
const outputPdf = path.join(projectDir, 'FORM_2_PROVISIONAL_SPEC.pdf');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_TOP = 68;
const MARGIN_BOTTOM = 62;
const MARGIN_LEFT = 78;
const MARGIN_RIGHT = 62;
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

function normalizeInline(text) {
  return normalizePlain(
    text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
  );
}

function normalizePlain(text) {
  return text
    .replace(/→/g, '->')
    .replace(/↓/g, 'v')
    .replace(/↑/g, '^')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/×/g, 'x')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .replace(/[^\x00-\x7F]/g, '');
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks = [];
  let paragraph = [];
  let code = [];
  let inCode = false;
  let listType = null;
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: normalizeInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: listType, items: listItems.map(normalizeInline) });
    listItems = [];
    listType = null;
  };

  const flushCode = () => {
    if (!code.length) return;
      blocks.push({ type: 'code', text: normalizePlain(code.join('\n')) });
    code = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'rule' });
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: normalizeInline(heading[2]),
      });
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ordered[1]);
      continue;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(unordered[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();
  return blocks;
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function main() {
  const markdown = fs.readFileSync(sourceMd, 'utf8');
  const blocks = parseMarkdown(markdown);

  const pdfDoc = await PDFDocument.create();
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    }
  };

  const drawLine = (text, opts = {}) => {
    const {
      x = MARGIN_LEFT,
      size = 11.5,
      font = times,
      color = rgb(0.07, 0.07, 0.07),
      leading = size * 1.35,
    } = opts;
    ensureSpace(leading);
    page.drawText(text, { x, y, size, font, color });
    y -= leading;
  };

  const drawParagraph = (text, opts = {}) => {
    const size = opts.size || 11.5;
    const font = opts.font || times;
    const leading = opts.leading || size * 1.45;
    const indent = opts.indent || 0;
    const lines = wrapText(text, font, size, CONTENT_W - indent);
    ensureSpace(lines.length * leading + 6);
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: MARGIN_LEFT + (idx === 0 ? indent : 0),
        y,
        size,
        font,
        color: rgb(0.07, 0.07, 0.07),
      });
      y -= leading;
    });
    y -= 4;
  };

  const drawRule = () => {
    ensureSpace(18);
    page.drawLine({
      start: { x: MARGIN_LEFT, y: y - 4 },
      end: { x: PAGE_W - MARGIN_RIGHT, y: y - 4 },
      thickness: 0.7,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 16;
  };

  const headingStyle = (level) => {
    if (level === 1) return { size: 18, font: timesBold, before: 0, after: 12, center: true };
    if (level === 2) return { size: 13.5, font: timesBold, before: 18, after: 8 };
    if (level === 3) return { size: 12, font: timesBold, before: 12, after: 6 };
    return { size: 11.5, font: timesBold, before: 8, after: 4 };
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      const style = headingStyle(block.level);
      y -= style.before;
      ensureSpace(style.size + style.after + 8);
      const text = block.text.toUpperCase();
      const width = style.font.widthOfTextAtSize(text, style.size);
      const x = style.center ? (PAGE_W - width) / 2 : MARGIN_LEFT;
      page.drawText(text, {
        x,
        y,
        size: style.size,
        font: style.font,
        color: rgb(0.05, 0.05, 0.05),
      });
      y -= style.size + style.after;
      continue;
    }

    if (block.type === 'rule') {
      drawRule();
      continue;
    }

    if (block.type === 'paragraph') {
      drawParagraph(block.text);
      continue;
    }

    if (block.type === 'ol' || block.type === 'ul') {
      for (let i = 0; i < block.items.length; i += 1) {
        const bullet = block.type === 'ol' ? `${i + 1}.` : '-';
        const bulletWidth = timesBold.widthOfTextAtSize(bullet, 11.2);
        const lines = wrapText(block.items[i], times, 11.2, CONTENT_W - 22);
        ensureSpace(lines.length * 16 + 2);
        page.drawText(bullet, {
          x: MARGIN_LEFT,
          y,
          size: 11.2,
          font: timesBold,
          color: rgb(0.07, 0.07, 0.07),
        });
        lines.forEach((line, idx) => {
          page.drawText(line, {
            x: MARGIN_LEFT + Math.max(18, bulletWidth + 8),
            y: y - idx * 16,
            size: 11.2,
            font: times,
            color: rgb(0.07, 0.07, 0.07),
          });
        });
        y -= lines.length * 16 + 3;
      }
      y -= 3;
      continue;
    }

    if (block.type === 'code') {
      const lines = block.text.split('\n');
      const size = 8.8;
      const leading = 11.2;
      const boxHeight = lines.length * leading + 18;
      ensureSpace(boxHeight + 8);
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: y - boxHeight + 6,
        width: CONTENT_W,
        height: boxHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.8,
        color: rgb(0.98, 0.975, 0.96),
      });
      let innerY = y - 12;
      lines.forEach((line) => {
        page.drawText(line, {
          x: MARGIN_LEFT + 10,
          y: innerY,
          size,
          font: courier,
          color: rgb(0.15, 0.15, 0.15),
        });
        innerY -= leading;
      });
      y -= boxHeight + 8;
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPdf, pdfBytes);
  console.log(outputPdf);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
