from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


PAGE_WIDTH = 595
PAGE_HEIGHT = 842
LEFT = 40
RIGHT = 555


def pdf_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
    )


def top(y_from_top: float) -> float:
    return PAGE_HEIGHT - y_from_top


@dataclass
class TextLine:
    x: float
    y: float
    text: str
    size: int = 10


@dataclass
class Field:
    name: str
    page_index: int
    x: float
    y: float
    w: float
    h: float
    multiline: bool = False
    value: str = ""


class PDFBuilder:
    def __init__(self) -> None:
        self.objects: list[bytes] = []

    def add(self, content: str | bytes) -> int:
        if isinstance(content, str):
            content = content.encode("latin-1", errors="replace")
        self.objects.append(content)
        return len(self.objects)

    def build(self) -> bytes:
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for idx, obj in enumerate(self.objects, start=1):
            offsets.append(len(out))
            out.extend(f"{idx} 0 obj\n".encode("ascii"))
            out.extend(obj)
            if not obj.endswith(b"\n"):
                out.extend(b"\n")
            out.extend(b"endobj\n")
        xref_start = len(out)
        out.extend(f"xref\n0 {len(self.objects) + 1}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            out.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
        out.extend(
            (
                f"trailer\n<< /Size {len(self.objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_start}\n%%EOF\n"
            ).encode("ascii")
        )
        return bytes(out)


def stream(text: str) -> bytes:
    data = text.encode("latin-1", errors="replace")
    return b"<< /Length %d >>\nstream\n%s\nendstream\n" % (len(data), data)


def add_page_text(lines: list[TextLine]) -> str:
    chunks = []
    for line in lines:
        chunks.append(
            f"BT /F1 {line.size} Tf 0 g 1 0 0 1 {line.x:.2f} {line.y:.2f} Tm "
            f"({pdf_escape(line.text)}) Tj ET"
        )
    return "\n".join(chunks)


def field_object(field: Field, page_ref: int) -> str:
    flags = 4096 if field.multiline else 0
    return (
        "<< /Type /Annot /Subtype /Widget"
        f" /FT /Tx /T ({pdf_escape(field.name)})"
        f" /Rect [{field.x:.2f} {field.y:.2f} {field.x + field.w:.2f} {field.y + field.h:.2f}]"
        f" /V ({pdf_escape(field.value)})"
        f" /F 4 /Ff {flags}"
        " /MK << /BC [0.65 0.65 0.65] /BG [1 1 1] >>"
        " /BS << /W 1 /S /S >>"
        " /DA (/Helv 10 Tf 0 g)"
        f" /P {page_ref} 0 R >>"
    )


def page_lines() -> list[list[TextLine]]:
    page1 = [
        TextLine(170, top(38), "FORM 1 - APPLICATION FOR GRANT OF PATENT", 14),
        TextLine(165, top(56), "[See sections 7, 54 and rule 20(1)]", 9),
        TextLine(40, top(84), "Generalized editable template based on the standard Indian patent Form 1 structure.", 9),
        TextLine(40, top(112), "1. APPLICANT(S)", 11),
        TextLine(40, top(128), "Name of applicant", 9),
        TextLine(40, top(155), "Address", 9),
        TextLine(40, top(232), "Nationality", 9),
        TextLine(300, top(232), "Country of residence / incorporation", 9),
        TextLine(40, top(259), "Email", 9),
        TextLine(300, top(259), "Phone", 9),
        TextLine(40, top(292), "2. INVENTOR(S)", 11),
        TextLine(40, top(308), "Name of inventor", 9),
        TextLine(40, top(335), "Address", 9),
        TextLine(40, top(412), "Nationality", 9),
        TextLine(300, top(412), "Country", 9),
        TextLine(40, top(445), "3. TITLE OF THE INVENTION", 11),
        TextLine(40, top(461), "Title", 9),
        TextLine(40, top(525), "4. TYPE OF APPLICATION", 11),
        TextLine(40, top(543), "Type initials", 8),
        TextLine(90, top(543), "Ordinary"),
        TextLine(195, top(543), "Convention"),
        TextLine(315, top(543), "PCT-NP"),
        TextLine(405, top(543), "Divisional"),
        TextLine(495, top(543), "Patent of Addition", 9),
        TextLine(40, top(573), "Specification", 8),
        TextLine(90, top(573), "Provisional"),
        TextLine(195, top(573), "Complete"),
        TextLine(40, top(612), "5. PRIORITY / RELATED APPLICATION DETAILS", 11),
        TextLine(40, top(630), "Application no.", 9),
        TextLine(230, top(630), "Date", 9),
        TextLine(330, top(630), "Country / office", 9),
        TextLine(40, top(735), "Note: Type \"X\" in the small boxes where you want to indicate a selection.", 8),
    ]

    page2 = [
        TextLine(185, top(38), "FORM 1 - APPLICATION FOR GRANT OF PATENT", 14),
        TextLine(40, top(78), "6. DECLARATIONS", 11),
        TextLine(40, top(98), "The applicant(s) declare that:", 9),
        TextLine(52, top(122), "a. the applicant is in possession of the invention and claims to be the true and first inventor", 9),
        TextLine(52, top(142), "   or is otherwise entitled to apply for the patent;", 9),
        TextLine(52, top(164), "b. the provisional / complete specification filed with this application describes the invention;", 9),
        TextLine(52, top(186), "c. to the best of the applicant's knowledge, the information supplied is true and complete;", 9),
        TextLine(52, top(208), "d. any required foreign filing or priority information will be provided as applicable.", 9),
        TextLine(40, top(248), "Agent / attorney details (if any)", 9),
        TextLine(40, top(345), "7. ADDRESS FOR SERVICE IN INDIA", 11),
        TextLine(40, top(363), "Name / firm", 9),
        TextLine(40, top(390), "Address", 9),
        TextLine(40, top(467), "Email", 9),
        TextLine(300, top(467), "Phone", 9),
        TextLine(40, top(500), "8. ATTACHMENTS / SUPPORTING DOCUMENTS", 11),
        TextLine(40, top(520), "Type initials", 8),
        TextLine(90, top(520), "Form 2 specification"),
        TextLine(255, top(520), "Drawings"),
        TextLine(335, top(520), "Form 3"),
        TextLine(410, top(520), "Form 5"),
        TextLine(480, top(520), "Form 26", 9),
        TextLine(40, top(548), "Type initials", 8),
        TextLine(90, top(548), "Priority document"),
        TextLine(225, top(548), "Assignment / proof of right", 9),
        TextLine(405, top(548), "Sequence listing", 9),
        TextLine(40, top(585), "Additional notes", 9),
        TextLine(40, top(690), "9. SIGNATURE", 11),
        TextLine(40, top(708), "Name", 9),
        TextLine(300, top(708), "Date", 9),
        TextLine(40, top(735), "Signature block", 9),
    ]

    page3 = [
        TextLine(210, top(38), "REFERENCE SUMMARY PAGE", 14),
        TextLine(40, top(76), "This editable PDF is a generalized filing worksheet for Indian Patent Form 1.", 10),
        TextLine(40, top(94), "It follows the common structure of Form 1, but it is not legal advice and should be", 10),
        TextLine(40, top(110), "checked against the latest IP India filing requirements before submission.", 10),
        TextLine(40, top(152), "Quick checklist before filing", 11),
        TextLine(52, top(178), "1. Confirm applicant category and fee class.", 9),
        TextLine(52, top(198), "2. Confirm whether you are filing with provisional or complete specification.", 9),
        TextLine(52, top(218), "3. Attach Form 2, drawings, and Form 3 where applicable.", 9),
        TextLine(52, top(238), "4. Use Form 18 / 18A separately for examination request when required.", 9),
        TextLine(52, top(258), "5. Keep the final filed acknowledgement and application number.", 9),
        TextLine(40, top(320), "Source basis", 11),
        TextLine(52, top(346), "IP India patent e-filing uses Form 1 for application for grant of patent.", 9),
        TextLine(52, top(366), "Examination request is handled separately and should not be merged into Form 1.", 9),
        TextLine(40, top(420), "Working notes", 11),
        TextLine(40, top(438), "Use this page to jot down filing references, portal IDs, and payment notes.", 9),
    ]
    return [page1, page2, page3]


def page_fields() -> list[Field]:
    fields = [
        Field("applicant_name", 0, 40, top(148), 515, 20),
        Field("applicant_address", 0, 40, top(222), 515, 58, multiline=True),
        Field("applicant_nationality", 0, 40, top(252), 220, 20),
        Field("applicant_country", 0, 300, top(252), 255, 20),
        Field("applicant_email", 0, 40, top(279), 220, 20),
        Field("applicant_phone", 0, 300, top(279), 255, 20),
        Field("inventor_name", 0, 40, top(328), 515, 20),
        Field("inventor_address", 0, 40, top(405), 515, 58, multiline=True),
        Field("inventor_nationality", 0, 40, top(432), 220, 20),
        Field("inventor_country", 0, 300, top(432), 255, 20),
        Field(
            "title_of_invention",
            0,
            40,
            top(515),
            515,
            40,
            multiline=True,
        ),
        Field("type_ordinary", 0, 40, top(548), 30, 18),
        Field("type_convention", 0, 145, top(548), 30, 18),
        Field("type_pct_np", 0, 255, top(548), 30, 18),
        Field("type_divisional", 0, 360, top(548), 30, 18),
        Field("type_patent_of_addition", 0, 455, top(548), 30, 18),
        Field("spec_provisional", 0, 40, top(578), 30, 18),
        Field("spec_complete", 0, 145, top(578), 30, 18),
        Field("priority_application_no", 0, 40, top(658), 160, 20),
        Field("priority_date", 0, 230, top(658), 70, 20),
        Field("priority_country", 0, 330, top(658), 225, 20),
        Field("agent_details", 1, 40, top(335), 515, 72, multiline=True),
        Field("service_name", 1, 40, top(383), 515, 20),
        Field("service_address", 1, 40, top(460), 515, 58, multiline=True),
        Field("service_email", 1, 40, top(487), 220, 20),
        Field("service_phone", 1, 300, top(487), 255, 20),
        Field("attach_form2", 1, 40, top(525), 30, 18),
        Field("attach_drawings", 1, 205, top(525), 30, 18),
        Field("attach_form3", 1, 305, top(525), 30, 18),
        Field("attach_form5", 1, 380, top(525), 30, 18),
        Field("attach_form26", 1, 450, top(525), 30, 18),
        Field("attach_priority_doc", 1, 40, top(553), 30, 18),
        Field("attach_assignment", 1, 180, top(553), 30, 18),
        Field("attach_sequence_listing", 1, 360, top(553), 30, 18),
        Field("additional_notes", 1, 40, top(675), 515, 78, multiline=True),
        Field("signatory_name", 1, 40, top(728), 220, 20),
        Field("sign_date", 1, 300, top(728), 255, 20),
        Field("signature_block", 1, 40, top(790), 515, 36, multiline=True),
        Field("working_notes", 2, 40, top(760), 515, 300, multiline=True),
    ]
    return fields


def generate_pdf(output_path: Path) -> None:
    builder = PDFBuilder()
    pages_ref = builder.add("<< /Type /Pages /Count 0 /Kids [] >>")
    helv_ref = builder.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    acroform_ref = builder.add(
        f"<< /Fields [] /NeedAppearances true /DR << /Font << /Helv {helv_ref} 0 R >> >> /DA (/Helv 10 Tf 0 g) >>"
    )
    builder.add(f"<< /Type /Catalog /Pages {pages_ref} 0 R /AcroForm {acroform_ref} 0 R >>")

    page_refs: list[int] = []
    content_refs: list[int] = []

    for lines in page_lines():
        content_refs.append(builder.add(stream(add_page_text(lines))))
        page_refs.append(0)

    fields = page_fields()

    # Reserve page objects first so field widgets can point to them.
    for idx, content_ref in enumerate(content_refs):
        page_fields_for_page = [f for f in fields if f.page_index == idx]
        dummy_annots = " ".join("0 0 R" for _ in page_fields_for_page)
        page_refs[idx] = builder.add(
            (
                f"<< /Type /Page /Parent {pages_ref} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {helv_ref} 0 R >> >> "
                f"/Contents {content_ref} 0 R /Annots [{dummy_annots}] >>"
            )
        )

    field_refs: list[int] = []
    for field in fields:
        field_refs.append(builder.add(field_object(field, page_refs[field.page_index])))

    # Replace placeholders with actual page and form references.
    page_fields_map: dict[int, list[int]] = {i: [] for i in range(len(page_refs))}
    for ref, field in zip(field_refs, fields):
        page_fields_map[field.page_index].append(ref)

    for idx, page_ref in enumerate(page_refs):
        annots = " ".join(f"{ref} 0 R" for ref in page_fields_map[idx])
        builder.objects[page_ref - 1] = (
            f"<< /Type /Page /Parent {pages_ref} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {helv_ref} 0 R >> >> "
            f"/Contents {content_refs[idx]} 0 R /Annots [{annots}] >>"
        ).encode("latin-1")

    kids = " ".join(f"{ref} 0 R" for ref in page_refs)
    builder.objects[pages_ref - 1] = (
        f"<< /Type /Pages /Count {len(page_refs)} /Kids [{kids}] >>"
    ).encode("latin-1")
    builder.objects[acroform_ref - 1] = (
        f"<< /Fields [{' '.join(f'{ref} 0 R' for ref in field_refs)}] "
        f"/NeedAppearances true /DR << /Font << /Helv {helv_ref} 0 R >> >> "
        "/DA (/Helv 10 Tf 0 g) >>"
    ).encode("latin-1")

    output_path.write_bytes(builder.build())


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    output = root / "FORM_1_APPLICATION_FOR_GRANT_OF_PATENT_EDITABLE.pdf"
    generate_pdf(output)
    print(output)
