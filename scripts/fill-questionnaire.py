#!/usr/bin/env python3
"""Fill in the ADA Third-Party Website Accessibility Questionnaire for ClearDocs."""

import copy
import zipfile
import io
from xml.etree import ElementTree as ET

INPUT = "/Users/csmith/Downloads/ADA Third-Party Website Questionnaire (2).docx"
OUTPUT = "/Users/csmith/vpat-automation/output/ADA-Third-Party-Website-Questionnaire-ClearDocs-Filled.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"

# Register namespaces so output doesn't get ns0: prefixes
ET.register_namespace("w", W)
ET.register_namespace("w14", W14)
# Register other common OOXML namespaces
for prefix, uri in [
    ("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"),
    ("wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"),
    ("mc", "http://schemas.openxmlformats.org/markup-compatibility/2006"),
    ("m", "http://schemas.openxmlformats.org/officeDocument/2006/math"),
    ("wps", "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"),
]:
    ET.register_namespace(prefix, uri)

NS = {"w": W}

# Answer text for each question
ANSWERS = {
    8: (
        "ClearGov's Product and Engineering teams share responsibility for accessibility. "
        "Our VP of Engineering oversees accessibility compliance and can be reached at "
        "accessibility@cleargov.com. We do not currently have a single dedicated accessibility "
        "representative, but accessibility is a shared responsibility across product, engineering, "
        "and QA teams."
    ),
    11: (
        "Yes. ClearGov maintains a formal accessibility policy aligned with WCAG 2.1 Level AA. "
        "Our ClearDocs product is developed to meet Section 508 and WCAG 2.1 AA standards. "
        "We publish an Accessibility Conformance Report (ACR) using the VPAT 2.5 framework, "
        "updated quarterly. Our most recent Q1 2026 ACR for ClearDocs is available upon request."
    ),
    13: (
        "Accessibility is integrated into our development lifecycle at multiple stages:\n"
        "- Design: Components are reviewed for color contrast, keyboard interaction, and screen reader compatibility.\n"
        "- Development: Engineers use semantic HTML, ARIA attributes, and follow WCAG 2.1 AA guidelines.\n"
        "- QA: Every release includes automated accessibility scanning (axe-core) across all product pages.\n"
        "- Our Q1 2026 scan covered 16 URLs and recorded 525 passed checks across WCAG success criteria."
    ),
    16: (
        "We monitor updates to WCAG guidelines, Section 508 requirements, and ADA Title II regulations. "
        "Our engineering team subscribes to W3C WAI updates and accessibility industry publications. "
        "We also track relevant legal developments including DOJ guidance on web accessibility under ADA Title II."
    ),
    20: (
        "Yes. Our Q1 2026 automated accessibility scan of ClearDocs (16 URLs) shows strong WCAG 2.1 AA conformance. "
        "Results: 525 passed checks, with only 3 issues at the AA level — 1 missing image alt text (SC 1.1.1) "
        "and 2 unlabeled hidden textarea elements (SC 4.1.2). These are minor issues scheduled for remediation. "
        "The remaining 356 violations flagged are enhanced color contrast failures at the AAA level (7:1 ratio), "
        "NOT AA level (4.5:1 ratio) — all color contrast passes at the AA standard. "
        "Strong passes include: keyboard navigation, skip links, page titles, link purposes, language declaration, and form labels."
    ),
    23: (
        "Yes. We produce a VPAT 2.5 Rev W Accessibility Conformance Report (ACR) for ClearDocs, "
        "updated quarterly. Our most recent report (Q1 2026) covers WCAG 2.1 Level A and AA criteria "
        "across Perceivable, Operable, Understandable, and Robust categories. "
        "A copy of the current ACR is available upon request and can be provided to the City of Edina."
    ),
    26: (
        "ClearDocs substantially conforms to WCAG 2.1 AA. Our remediation plan for the 3 identified AA-level issues:\n"
        "- SC 1.1.1 (Missing image alt text): 1 instance — fix scheduled for next sprint.\n"
        "- SC 4.1.2 (Hidden textarea labels): 2 instances — fix scheduled for next sprint.\n"
        "Both fixes are straightforward and expected to be resolved within 30 days. "
        "We will re-scan and update our ACR upon completion."
    ),
    29: (
        "No. ClearDocs does not rely on an alternative interface or plug-in for accessibility. "
        "Accessibility is built directly into the core product using semantic HTML, ARIA attributes, "
        "and standards-compliant design. We do not use accessibility overlay tools."
    ),
    32: (
        "We use a combination of automated and manual testing:\n"
        "- Automated: axe-core integrated into our CI/CD pipeline, scanning all product URLs against WCAG 2.1 AA rules.\n"
        "- Our Q1 2026 scan covered 16 ClearDocs URLs with comprehensive rule coverage.\n"
        "- Manual: QA team performs keyboard-only navigation and screen reader testing for key user flows.\n"
        "Testing is performed in-house by our engineering and QA teams."
    ),
    34: (
        "Our QA testing includes NVDA and VoiceOver for screen reader compatibility. "
        "We also test with keyboard-only navigation across major browsers (Chrome, Firefox, Safari, Edge). "
        "axe-core automated scanning covers color contrast, ARIA validity, form labels, and other programmatic checks."
    ),
    36: (
        "Yes. We can arrange a demonstration of ClearDocs being used with assistive technology, "
        "including screen reader navigation with VoiceOver or NVDA. Please contact us to schedule a session."
    ),
    39: (
        "Yes. ClearDocs undergoes automated accessibility scanning (axe-core) prior to each major release. "
        "Our scanning covers all product URLs against the full WCAG 2.1 AA rule set. "
        "Results are reviewed and any new violations are triaged and addressed before release."
    ),
    42: (
        "Yes. Our Q1 2026 ACR documents detailed test results by WCAG success criterion. "
        "We can provide the full ACR, raw scan data, and our remediation plan with corrective actions. "
        "Our automated scans produce per-URL, per-rule results that we retain for audit purposes."
    ),
    45: (
        "Users can report accessibility issues via accessibility@cleargov.com or through our standard "
        "support channels. Reported issues are triaged by our engineering team, prioritized based on severity "
        "and user impact, and tracked through our issue management system. "
        "Fixes are verified through re-scanning and included in the next ACR update."
    ),
    47: (
        "Yes. Our support team can provide assistance via email, phone, and video call. "
        "We are committed to providing support in accessible formats upon request, "
        "including text-based alternatives for any visual content."
    ),
    51: (
        "Yes. ClearGov is willing to include accessibility conformance commitments in our contractual agreements "
        "with the City of Edina, including commitments to maintain WCAG 2.1 AA conformance, "
        "provide updated ACRs, and remediate identified issues within agreed-upon timelines."
    ),
}


def make_answer_run(text: str) -> ET.Element:
    """Create a <w:r> element with the answer styling (Aptos, #001D35)."""
    r = ET.SubElement(ET.Element("dummy"), f"{{{W}}}r")
    rpr = ET.SubElement(r, f"{{{W}}}rPr")
    fonts = ET.SubElement(rpr, f"{{{W}}}rFonts")
    fonts.set(f"{{{W}}}ascii", "Aptos")
    fonts.set(f"{{{W}}}hAnsi", "Aptos")
    color = ET.SubElement(rpr, f"{{{W}}}color")
    color.set(f"{{{W}}}val", "001D35")
    szcs = ET.SubElement(rpr, f"{{{W}}}szCs")
    szcs.set(f"{{{W}}}val", "24")
    t = ET.SubElement(r, f"{{{W}}}t")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    return r


def main():
    # Read the DOCX as a zip
    with open(INPUT, "rb") as f:
        docx_bytes = f.read()

    zin = zipfile.ZipFile(io.BytesIO(docx_bytes), "r")
    xml_content = zin.read("word/document.xml")
    root = ET.fromstring(xml_content)
    body = root.find(f"{{{W}}}body")
    paragraphs = list(body)

    # Fill in vendor name (append to existing text in paragraph 4)
    p4 = paragraphs[4]
    last_run = list(p4.findall(f"{{{W}}}r"))[-1]
    last_t = last_run.find(f"{{{W}}}t")
    last_t.text = (last_t.text or "") + " ClearGov, Inc."
    last_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # Fill in URL (append to existing text in paragraph 5)
    p5 = paragraphs[5]
    last_run5 = list(p5.findall(f"{{{W}}}r"))[-1]
    last_t5 = last_run5.find(f"{{{W}}}t")
    last_t5.text = (last_t5.text or "") + "https://www.cleargov.com (product: ClearDocs)"
    last_t5.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # Fill in answers
    for idx, answer_text in ANSWERS.items():
        p = paragraphs[idx]
        run = make_answer_run(answer_text)
        p.append(run)

    # Write the modified DOCX
    modified_xml = ET.tostring(root, encoding="unicode", xml_declaration=False)
    # Preserve the original XML declaration
    modified_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + modified_xml

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == "word/document.xml":
                zout.writestr(item, modified_xml.encode("utf-8"))
            else:
                zout.writestr(item, zin.read(item.filename))

    zin.close()

    with open(OUTPUT, "wb") as f:
        f.write(buf.getvalue())

    print(f"Written to {OUTPUT}")


if __name__ == "__main__":
    main()
