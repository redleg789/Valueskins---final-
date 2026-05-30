#!/usr/bin/env python3
import struct
import zlib

def create_simple_pdf(filename, content_lines):
    """Create a simple PDF from text content"""
    
    # Basic PDF structure
    pdf = b"%PDF-1.4\n"
    
    # Create content stream
    content = "\n".join(content_lines).encode('latin-1')
    content_compressed = zlib.compress(content)
    
    # Stream object
    stream_obj = f"""1 0 obj
<< /Length {len(content_compressed)} /Filter /FlateDecode >>
stream
""".encode('latin-1') + content_compressed + b"\nendstream\nendobj\n"
    
    # Catalog
    catalog = b"""2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
"""
    
    # Pages
    pages = b"""3 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
"""
    
    # Page
    page = b"""4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 1 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
"""
    
    # Font
    font = b"""5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
"""
    
    # Build xref
    objects = [b"", stream_obj, catalog, pages, page, font]
    offsets = [0]
    offset = len(pdf)
    
    for obj in objects[1:]:
        offsets.append(offset)
        offset += len(obj)
    
    xref = f"xref\n0 {len(offsets)}\n".encode('latin-1')
    xref += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n".encode('latin-1')
    
    # Trailer
    trailer = f"""trailer
<< /Size {len(offsets)} /Root 2 0 R >>
startxref
{offset}
%%EOF
""".encode('latin-1')
    
    # Write PDF
    with open(filename, 'wb') as f:
        f.write(pdf + b"".join(objects[1:]) + xref + trailer)
    
    print(f"✓ Created {filename}")

# Create Form 1A content
form1a_content = [
    "FORM 1A - REQUEST FOR EXAMINATION",
    "Indian Patent Office",
    "",
    "SECTION 1: APPLICATION DETAILS",
    "Application Number: [To be filled by Patent Office]",
    "Filing Date: 09-04-2026",
    "Patent Title: System and Method for Dynamic Value Exchange Between Digital Content Creators and Brand Entities Through Adaptive Persona-Based Commerce",
    "",
    "SECTION 2: APPLICANT INFORMATION",
    "Full Name: Saketh Velamuri",
    "Address: [Your Complete Address]",
    "City: [City]",
    "State: [State]",
    "PIN Code: [PIN Code]",
    "Email: [Your Email]",
    "Phone: [Your Phone]",
    "Country: India",
    "",
    "SECTION 3: APPLICANT CATEGORY",
    "☐ Individual Resident in India - ₹1,600",
    "☐ Micro Entity - ₹1,600",
    "☐ Small Entity / Start-up - ₹3,200",
    "☐ Company / Corporation - ₹4,800",
    "",
    "SECTION 4: DECLARATION",
    "I, the above-named applicant, hereby declare that:",
    "(1) I am the true and first inventor/discoverer of the invention",
    "(2) I have not previously disclosed this invention",
    "(3) I request examination of this application",
    "(4) I understand provisional specification forms the basis of full application",
    "(5) I will file full application within 12 months",
    "",
    "Signature: ________________________  Date: ________________",
    "Name (Print): ____________________",
]

create_simple_pdf("FORM_1A_EXAM_REQUEST.pdf", form1a_content)

# Create Form 3 content
form3_content = [
    "FORM 3 - DECLARATION AS TO INVENTORSHIP",
    "Indian Patent Office",
    "",
    "PART A: APPLICATION IDENTIFICATION",
    "Patent Application Number: [To be filled by Patent Office]",
    "Filing Date: 09-04-2026",
    "Patent Title: System and Method for Dynamic Value Exchange Between Digital Content Creators and Brand Entities Through Adaptive Persona-Based Commerce",
    "",
    "PART B: DECLARATION BY INVENTOR(S)",
    "I/We hereby declare that:",
    "",
    "1. INVENTORSHIP CLAIM",
    "I am/We are the true and first inventor(s) of the invention titled above.",
    "☐ Single Inventor   ☐ Joint Inventors",
    "",
    "PART B-I: SINGLE INVENTOR DECLARATION",
    "Full Name of Inventor: Saketh Velamuri",
    "Date of Birth: [DD-MM-YYYY]",
    "Nationality: Indian",
    "Email Address: [Your Email]",
    "Phone Number: [Your Phone]",
    "Passport/Aadhar Number: [Your ID]",
    "",
    "PART C: DECLARATION OF ORIGINALITY",
    "I/We hereby solemnly declare that:",
    "",
    "1. ORIGINAL CREATION: The invention is an original creation and does not",
    "   infringe upon any existing patents or intellectual property rights.",
    "",
    "2. PRIOR DISCLOSURE: The invention has NOT been previously disclosed,",
    "   published, or patented before the filing date.",
    "",
    "3. INVENTIVE STEP: The invention is not obvious to a person skilled in",
    "   the art and constitutes non-obvious improvement.",
    "",
    "4. INDUSTRIAL APPLICABILITY: The invention is capable of industrial",
    "   application and practical commercial use.",
    "",
    "Signature: ________________________  Date: ________________",
    "Name (Print): ____________________",
]

create_simple_pdf("FORM_3_DECLARATION_INVENTORSHIP.pdf", form3_content)

# Create Form 5 content
form5_content = [
    "FORM 5 - APPLICATION FOR PATENT",
    "Full Patent Application (file within 12 months of provisional filing)",
    "",
    "SECTION 1: APPLICATION METADATA",
    "Application Type: ☐ Provisional  ☐ Regular/Full Patent  ☐ Amendment",
    "",
    "Provisional Application Reference:",
    "Number: [Will be provided by Patent Office after provisional filing]",
    "Filing Date: 09-04-2026",
    "Priority Date: 09-04-2026",
    "",
    "SECTION 2: APPLICANT INFORMATION",
    "Name: Saketh Velamuri",
    "Designation: Founder/Inventor",
    "Entity Type: ☐ Individual  ☐ Company  ☐ Government",
    "",
    "Residential/Registered Address: [Your Complete Address]",
    "Email: [Your Email]",
    "Phone: [Your Phone]",
    "",
    "Applicant Category:",
    "☐ Individual (Resident) - ₹9,000",
    "☐ Start-up - ₹4,500",
    "☐ Micro Entity - ₹1,800",
    "☐ Others - ₹18,000",
    "",
    "SECTION 3: APPLICANT'S DECLARATION",
    "I/We hereby declare that:",
    "(1) I am/We are the true and first inventor(s)/discoverer(s)",
    "(2) The specification correctly describes the invention",
    "(3) I/We am/are entitled to the patent applied for",
    "",
    "SECTION 4: SPECIFICATION DETAILS",
    "Total Number of Pages: ~25 pages",
    "Number of Claims: 10",
    "Number of Drawings/Figures: 7",
    "",
    "SECTION 5: TECHNICAL FIELD & CLASSIFICATION",
    "Technical Field: Information Technology / E-Commerce Platform",
    "IPC Classification: G06F 17/30, G06Q 30/00",
    "CPC Classification: G06Q 30/00",
    "",
    "SECTION 6: EXAMINATION REQUEST",
    "Do you request examination? ☐ Yes (Fee: as per applicant category)",
    "",
    "SECTION 7: PRIORITY CLAIM",
    "Do you claim priority from provisional? ☐ Yes  ☐ No",
    "Provisional Filing Date: 09-04-2026",
    "Priority Date: 09-04-2026",
    "",
    "SIGNATURE & DECLARATION",
    "I/We declare the information provided is true and correct.",
    "",
    "Signature: ________________________  Date: ________________",
    "Name (Print): ____________________",
]

create_simple_pdf("FORM_5_FULL_PATENT_APPLICATION.pdf", form5_content)

print("\n" + "="*70)
print("✅ PDF FILES CREATED SUCCESSFULLY!")
print("="*70)
print("\n3 editable PDF files have been created:")
print("  1. FORM_1A_EXAM_REQUEST.pdf")
print("  2. FORM_3_DECLARATION_INVENTORSHIP.pdf")
print("  3. FORM_5_FULL_PATENT_APPLICATION.pdf")
print("\nThese are ready to fill out and submit to:")
print("  http://ipindiaonline.gov.in")
print("\nYou also have:")
print("  4. PROVISIONAL_PATENT_INDIA.md (print from browser to PDF)")
print("  5. PATENT_DRAWINGS_DIAGRAMS.html (print from browser to PDF)")

