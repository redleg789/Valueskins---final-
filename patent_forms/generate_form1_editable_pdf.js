const fs = require('fs');
const path = require('path');
const {
  PDFDocument,
  StandardFonts,
  rgb,
} = require('pdf-lib');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

function y(top) {
  return PAGE_HEIGHT - top;
}

function drawText(page, text, x, topPos, size = 10) {
  page.drawText(text, {
    x,
    y: y(topPos),
    size,
    font: page.docFont,
    color: rgb(0, 0, 0),
  });
}

function drawFieldBox(page, x, topPos, width, height) {
  page.drawRectangle({
    x,
    y: y(topPos + height),
    width,
    height,
    borderColor: rgb(0.65, 0.65, 0.65),
    borderWidth: 1,
  });
}

function addTextField(form, page, name, x, topPos, width, height, opts = {}) {
  const field = form.createTextField(name);
  if (opts.multiline) field.enableMultiline();
  field.setText(opts.value || '');
  field.addToPage(page, {
    x,
    y: y(topPos + height),
    width,
    height,
    borderColor: rgb(0.65, 0.65, 0.65),
    borderWidth: 1,
    textColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
  });
  return field;
}

async function main() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = pdfDoc.getForm();

  function newPage() {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.docFont = helvetica;
    page.boldFont = helveticaBold;
    return page;
  }

  const page1 = newPage();
  page1.drawText('FORM 1 - APPLICATION FOR GRANT OF PATENT', {
    x: 155,
    y: y(38),
    size: 14,
    font: helveticaBold,
  });
  drawText(page1, '[See sections 7, 54 and rule 20(1)]', 170, 56, 9);
  drawText(
    page1,
    'Generalized editable template based on the standard Indian patent Form 1 structure.',
    MARGIN,
    84,
    9,
  );

  drawText(page1, '1. APPLICANT(S)', MARGIN, 112, 11);
  drawText(page1, 'Name of applicant', MARGIN, 128, 9);
  addTextField(form, page1, 'applicant_name', MARGIN, 136, 515, 20, {
    value: 'Saketh Velamuri',
  });

  drawText(page1, 'Address', MARGIN, 164, 9);
  addTextField(form, page1, 'applicant_address', MARGIN, 172, 515, 58, {
    multiline: true,
  });

  drawText(page1, 'Nationality', MARGIN, 238, 9);
  addTextField(form, page1, 'applicant_nationality', MARGIN, 246, 220, 20, {
    value: 'Indian',
  });
  drawText(page1, 'Country of residence / incorporation', 300, 238, 9);
  addTextField(form, page1, 'applicant_country', 300, 246, 255, 20, {
    value: 'India',
  });

  drawText(page1, 'Email', MARGIN, 271, 9);
  addTextField(form, page1, 'applicant_email', MARGIN, 279, 220, 20);
  drawText(page1, 'Phone', 300, 271, 9);
  addTextField(form, page1, 'applicant_phone', 300, 279, 255, 20);

  drawText(page1, '2. INVENTOR(S)', MARGIN, 312, 11);
  drawText(page1, 'Name of inventor', MARGIN, 328, 9);
  addTextField(form, page1, 'inventor_name', MARGIN, 336, 515, 20, {
    value: 'Saketh Velamuri',
  });

  drawText(page1, 'Address', MARGIN, 364, 9);
  addTextField(form, page1, 'inventor_address', MARGIN, 372, 515, 58, {
    multiline: true,
  });

  drawText(page1, 'Nationality', MARGIN, 438, 9);
  addTextField(form, page1, 'inventor_nationality', MARGIN, 446, 220, 20, {
    value: 'Indian',
  });
  drawText(page1, 'Country', 300, 438, 9);
  addTextField(form, page1, 'inventor_country', 300, 446, 255, 20, {
    value: 'India',
  });

  drawText(page1, '3. TITLE OF THE INVENTION', MARGIN, 478, 11);
  drawText(page1, 'Title', MARGIN, 494, 9);
  addTextField(form, page1, 'title_of_invention', MARGIN, 502, 515, 38, {
    multiline: true,
    value:
      'System and Method for Dynamic Value Exchange Between Digital Content Creators and Brand Entities Through Adaptive Persona-Based Commerce',
  });

  drawText(page1, '4. TYPE OF APPLICATION', MARGIN, 552, 11);
  drawText(page1, 'Type initials', MARGIN, 570, 8);
  const typeOptions = [
    ['type_ordinary', 'Ordinary', 40],
    ['type_convention', 'Convention', 145],
    ['type_pct_np', 'PCT-NP', 255],
    ['type_divisional', 'Divisional', 360],
    ['type_patent_of_addition', 'Patent of Addition', 455],
  ];
  typeOptions.forEach(([name, label, x]) => {
    addTextField(form, page1, name, x, 578, 30, 18);
    drawText(page1, label, x + 40, 582, 9);
  });

  drawText(page1, 'Specification', MARGIN, 608, 8);
  addTextField(form, page1, 'spec_provisional', 40, 616, 30, 18);
  drawText(page1, 'Provisional', 80, 620, 9);
  addTextField(form, page1, 'spec_complete', 145, 616, 30, 18);
  drawText(page1, 'Complete', 185, 620, 9);

  drawText(page1, '5. PRIORITY / RELATED APPLICATION DETAILS', MARGIN, 652, 11);
  drawText(page1, 'Application no.', MARGIN, 670, 9);
  addTextField(form, page1, 'priority_application_no', MARGIN, 678, 160, 20);
  drawText(page1, 'Date', 230, 670, 9);
  addTextField(form, page1, 'priority_date', 230, 678, 70, 20, {
    value: '09-04-2026',
  });
  drawText(page1, 'Country / office', 330, 670, 9);
  addTextField(form, page1, 'priority_country', 330, 678, 225, 20, {
    value: 'India / Indian Patent Office',
  });

  drawText(
    page1,
    'Use "X" in the small boxes where you want to indicate a selection.',
    MARGIN,
    735,
    8,
  );

  const page2 = newPage();
  page2.drawText('FORM 1 - APPLICATION FOR GRANT OF PATENT', {
    x: 170,
    y: y(38),
    size: 14,
    font: helveticaBold,
  });

  drawText(page2, '6. DECLARATIONS', MARGIN, 78, 11);
  drawText(page2, 'The applicant(s) declare that:', MARGIN, 98, 9);
  drawText(page2, 'a. the applicant is in possession of the invention and claims to be the true and first inventor', 52, 122, 9);
  drawText(page2, '   or is otherwise entitled to apply for the patent;', 52, 142, 9);
  drawText(page2, 'b. the provisional / complete specification filed with this application describes the invention;', 52, 164, 9);
  drawText(page2, 'c. to the best of the applicant\'s knowledge, the information supplied is true and complete;', 52, 186, 9);
  drawText(page2, 'd. any required foreign filing or priority information will be provided as applicable.', 52, 208, 9);

  drawText(page2, 'Agent / attorney details (if any)', MARGIN, 248, 9);
  addTextField(form, page2, 'agent_details', MARGIN, 256, 515, 72, {
    multiline: true,
  });

  drawText(page2, '7. ADDRESS FOR SERVICE IN INDIA', MARGIN, 345, 11);
  drawText(page2, 'Name / firm', MARGIN, 363, 9);
  addTextField(form, page2, 'service_name', MARGIN, 371, 515, 20);
  drawText(page2, 'Address', MARGIN, 399, 9);
  addTextField(form, page2, 'service_address', MARGIN, 407, 515, 58, {
    multiline: true,
  });
  drawText(page2, 'Email', MARGIN, 473, 9);
  addTextField(form, page2, 'service_email', MARGIN, 481, 220, 20);
  drawText(page2, 'Phone', 300, 473, 9);
  addTextField(form, page2, 'service_phone', 300, 481, 255, 20);

  drawText(page2, '8. ATTACHMENTS / SUPPORTING DOCUMENTS', MARGIN, 518, 11);
  const attachments = [
    ['attach_form2', 'Form 2 specification', 40, 526],
    ['attach_drawings', 'Drawings', 205, 526],
    ['attach_form3', 'Form 3', 305, 526],
    ['attach_form5', 'Form 5', 380, 526],
    ['attach_form26', 'Form 26', 450, 526],
    ['attach_priority_doc', 'Priority document', 40, 554],
    ['attach_assignment', 'Assignment / proof of right', 180, 554],
    ['attach_sequence_listing', 'Sequence listing', 360, 554],
  ];
  attachments.forEach(([name, label, x, topPos]) => {
    addTextField(form, page2, name, x, topPos, 30, 18);
    drawText(page2, label, x + 40, topPos + 4, 9);
  });

  drawText(page2, 'Additional notes', MARGIN, 590, 9);
  addTextField(form, page2, 'additional_notes', MARGIN, 598, 515, 78, {
    multiline: true,
  });

  drawText(page2, '9. SIGNATURE', MARGIN, 690, 11);
  drawText(page2, 'Name', MARGIN, 708, 9);
  addTextField(form, page2, 'signatory_name', MARGIN, 716, 220, 20);
  drawText(page2, 'Date', 300, 708, 9);
  addTextField(form, page2, 'sign_date', 300, 716, 255, 20);
  drawText(page2, 'Signature block', MARGIN, 746, 9);
  addTextField(form, page2, 'signature_block', MARGIN, 754, 515, 36, {
    multiline: true,
  });

  form.updateFieldAppearances(helvetica);

  const pdfBytes = await pdfDoc.save({
    useObjectStreams: false,
  });

  const outPath = path.join(
    process.cwd(),
    'FORM_1_APPLICATION_FOR_GRANT_OF_PATENT_EDITABLE.pdf',
  );
  fs.writeFileSync(outPath, pdfBytes);
  console.log(outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
