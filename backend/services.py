import os
import io
import json
import re
import httpx
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_MODEL = os.environ.get("CF_MODEL", "@cf/qwen/qwen2.5-7b-instruct")

# -------------------------------------------------------------
# 1. Precise Python Math Calculation & Validation
# -------------------------------------------------------------
def calculate_invoice_totals(items: List[Dict[str, Any]], tax_rate: float) -> Dict[str, Any]:
    """
    Validates and recalculates line items, subtotal, tax amount, and total
    using pure Python. Enforces mathematical consistency: Quantity = Amount / Rate.
    """
    tax_rate = max(0.0, float(tax_rate or 0.0))
    validated_items = []
    subtotal = 0.0

    for item in items:
        desc = str(item.get("description", "")).strip() or "Item"
        qty = float(item.get("quantity", 1.0) or 1.0)
        unit_price = float(item.get("unit_price", 0.0) or 0.0)
        stated_amount = float(item.get("amount", 0.0) or 0.0)

        # Mathematical Quantity Consistency Check:
        # If stated_amount > unit_price, check if stated_amount / unit_price is an exact integer ratio
        if unit_price > 0 and stated_amount > 0:
            ratio = round(stated_amount / unit_price, 2)
            if 1.0 <= ratio <= 100.0 and abs(ratio - round(ratio)) < 0.05:
                # Reconcile quantity to the exact mathematical ratio
                qty = float(round(ratio))

        # Recompute exact line amount
        if unit_price > 0 and qty > 0:
            amount = round(qty * unit_price, 2)
        elif stated_amount > 0:
            amount = stated_amount
            unit_price = stated_amount
            qty = 1.0
        else:
            amount = 0.0

        subtotal += amount

        validated_items.append({
            "description": desc,
            "quantity": qty,
            "unit_price": unit_price,
            "amount": amount
        })

    subtotal = round(subtotal, 2)
    tax_amount = round(subtotal * (tax_rate / 100.0), 2)
    total = round(subtotal + tax_amount, 2)

    return {
        "items": validated_items,
        "tax_rate": tax_rate,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total": total
    }

# -------------------------------------------------------------
# 2. PDF Generator (Clean, Professional, Reference-inspired)
# -------------------------------------------------------------
def generate_pdf(invoice_data: Dict[str, Any]) -> io.BytesIO:
    """
    Builds a styled PDF invoice with deep green accents and clear table borders.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom color palette matching the theme
    forest_green = colors.HexColor("#1E3F30")
    cream_bg = colors.HexColor("#F7F5F0")
    border_black = colors.HexColor("#111111")
    text_dark = colors.HexColor("#1A1A1A")
    muted_text = colors.HexColor("#555555")

    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=colors.white,
        spaceAfter=4
    )
    
    header_subtitle = ParagraphStyle(
        'HeaderSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#D8E2DC"),
    )

    normal_bold = ParagraphStyle(
        'NormalBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=text_dark
    )

    normal_text = ParagraphStyle(
        'NormalText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=text_dark
    )

    elements = []

    # 1. Header Banner
    company_name = invoice_data.get("company_name", "My Company") or "My Company"
    company_email = invoice_data.get("company_email", "") or ""
    inv_num = invoice_data.get("invoice_number", "INV-001") or "INV-001"
    
    header_left = [
        Paragraph(f"<b>{company_name.upper()}</b>", title_style),
        Paragraph(f"{company_email}", header_subtitle)
    ]
    
    status = (invoice_data.get("status", "PAID") or "PAID").upper()
    header_right = [
        Paragraph(f"<b>INVOICE</b>", ParagraphStyle('InvRight', parent=title_style, alignment=2)),
        Paragraph(f"<b>#{inv_num}</b>  |  [{status}]", ParagraphStyle('InvMeta', parent=header_subtitle, alignment=2))
    ]

    header_table = Table([[header_left, header_right]], colWidths=[340, 200])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), forest_green),
        ('PADDING', (0, 0), (-1, -1), 16),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 16))

    # 2. Bill To & Metadata block
    cust_name = invoice_data.get("customer_name", "") or "Valued Client"
    cust_email = invoice_data.get("customer_email", "") or "-"
    issue_date = invoice_data.get("issue_date", "") or "-"
    due_date = invoice_data.get("due_date", "") or "-"
    terms = invoice_data.get("payment_terms", "Due on Receipt") or "Due on Receipt"

    bill_to_content = [
        Paragraph("<b>BILLED TO:</b>", normal_bold),
        Paragraph(f"<b>{cust_name}</b>", normal_text),
        Paragraph(f"Email: {cust_email}", normal_text),
    ]

    meta_content = [
        Paragraph(f"<b>Issue Date:</b> {issue_date}", normal_text),
        Paragraph(f"<b>Due Date:</b> {due_date}", normal_text),
        Paragraph(f"<b>Payment Terms:</b> {terms}", normal_text),
    ]

    info_table = Table([[bill_to_content, meta_content]], colWidths=[340, 200])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), cream_bg),
        ('BOX', (0, 0), (-1, -1), 1.5, border_black),
        ('PADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 16))

    # 3. Line Items Table
    table_data = [[
        Paragraph("<b>ITEM / DESCRIPTION</b>", normal_bold),
        Paragraph("<b>QTY</b>", ParagraphStyle('HQty', parent=normal_bold, alignment=1)),
        Paragraph("<b>UNIT PRICE</b>", ParagraphStyle('HPrice', parent=normal_bold, alignment=2)),
        Paragraph("<b>AMOUNT</b>", ParagraphStyle('HAmt', parent=normal_bold, alignment=2)),
    ]]

    items = invoice_data.get("items", [])
    for it in items:
        desc = it.get("description", "Item")
        qty = f"{it.get('quantity', 1):.2f}".rstrip('0').rstrip('.')
        price = f"${it.get('unit_price', 0):.2f}"
        amount = f"${it.get('amount', 0):.2f}"
        table_data.append([
            Paragraph(desc, normal_text),
            Paragraph(qty, ParagraphStyle('RQty', parent=normal_text, alignment=1)),
            Paragraph(price, ParagraphStyle('RPrice', parent=normal_text, alignment=2)),
            Paragraph(amount, ParagraphStyle('RAmt', parent=normal_text, alignment=2)),
        ])

    items_table = Table(table_data, colWidths=[280, 60, 100, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EAE6DE")),
        ('TEXTCOLOR', (0, 0), (-1, 0), text_dark),
        ('BOX', (0, 0), (-1, -1), 1.5, border_black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 16))

    # 4. Totals & Notes Section
    notes = invoice_data.get("notes", "") or "Thank you for your business!"
    notes_cell = [
        Paragraph("<b>Notes / Payment Instructions:</b>", normal_bold),
        Paragraph(notes, normal_text)
    ]

    subtotal = invoice_data.get("subtotal", 0.0)
    tax_rate = invoice_data.get("tax_rate", 0.0)
    tax_amount = invoice_data.get("tax_amount", 0.0)
    total = invoice_data.get("total", 0.0)

    totals_table_data = [
        [Paragraph("Subtotal:", normal_text), Paragraph(f"${subtotal:.2f}", ParagraphStyle('T1', parent=normal_text, alignment=2))],
        [Paragraph(f"Tax ({tax_rate}%):", normal_text), Paragraph(f"${tax_amount:.2f}", ParagraphStyle('T2', parent=normal_text, alignment=2))],
        [Paragraph("<b>TOTAL:</b>", normal_bold), Paragraph(f"<b>${total:.2f}</b>", ParagraphStyle('T3', parent=normal_bold, fontSize=12, alignment=2))],
    ]
    totals_subtable = Table(totals_table_data, colWidths=[90, 90])
    totals_subtable.setStyle(TableStyle([
        ('LINEABOVE', (0, 2), (-1, 2), 1, border_black),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))

    summary_table = Table([[notes_cell, totals_subtable]], colWidths=[340, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (1, 0), (1, 0), cream_bg),
        ('BOX', (1, 0), (1, 0), 1.5, border_black),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(summary_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer

# -------------------------------------------------------------
# 3. Document OCR Service (RapidOCR + PyMuPDF + Tesseract fallback)
# -------------------------------------------------------------
_rapid_ocr = None

def get_ocr_engine():
    global _rapid_ocr
    if _rapid_ocr is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _rapid_ocr = RapidOCR()
        except Exception as e:
            print(f"[RapidOCR Init Error]: {e}")
            _rapid_ocr = None
    return _rapid_ocr


def cluster_boxes_into_rows(ocr_results, y_tolerance=18) -> List[str]:
    """
    Reconstructs invoice tables by clustering detected bounding boxes
    into horizontal rows based on vertical Y-coordinates and sorting left-to-right.
    Prevents column splitting in multi-column invoice tables.
    """
    items = []
    for item in ocr_results:
        if not item or len(item) < 2:
            continue
        box = item[0]
        text = str(item[1]).strip()
        if not text:
            continue
        # Calculate box center
        center_y = sum(p[1] for p in box) / 4.0
        center_x = sum(p[0] for p in box) / 4.0
        items.append({"x": center_x, "y": center_y, "text": text})

    if not items:
        return []

    # Sort primarily by vertical Y position
    items.sort(key=lambda it: it["y"])

    rows = []
    for it in items:
        placed = False
        for row in rows:
            if abs(it["y"] - row["y_avg"]) < y_tolerance:
                row["items"].append(it)
                row["y_avg"] = sum(x["y"] for x in row["items"]) / len(row["items"])
                placed = True
                break
        if not placed:
            rows.append({"y_avg": it["y"], "items": [it]})

    # Sort each row horizontally (left to right) and join
    text_lines = []
    for row in rows:
        row["items"].sort(key=lambda it: it["x"])
        line_str = "  ".join(it["text"] for it in row["items"])
        if line_str.strip():
            text_lines.append(line_str)

    return text_lines


def ocr_image_bytes(img_bytes: bytes) -> str:
    """Runs high-accuracy OCR on image bytes using RapidOCR with geometric row clustering"""
    ocr_engine = get_ocr_engine()
    if ocr_engine:
        try:
            import cv2
            import numpy as np
            
            # Decode image
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                # Run OCR on original image
                result, _ = ocr_engine(img)
                if result:
                    lines = cluster_boxes_into_rows(result)
                    if lines:
                        return "\n".join(lines)
            else:
                # Direct byte fallback
                result, _ = ocr_engine(img_bytes)
                if result:
                    lines = cluster_boxes_into_rows(result)
                    if lines:
                        return "\n".join(lines)
        except Exception as e:
            print(f"[RapidOCR Process Error]: {e}")

    # Fallback to pytesseract if installed on the system
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        t = pytesseract.image_to_string(img)
        if t and t.strip():
            return t
    except Exception as e:
        print(f"[Pytesseract Error]: {e}")

    return ""


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from PDF (PyMuPDF) or images (RapidOCR / Tesseract).
    Never decodes raw binary image bytes as text.
    """
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            extracted_pages = []
            for page in doc:
                t = page.get_text()
                if t and t.strip():
                    extracted_pages.append(t)
            
            if extracted_pages:
                return "\n".join(extracted_pages)
            
            # Scanned PDF: render pages to images and run RapidOCR
            ocr_pages = []
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                page_text = ocr_image_bytes(img_data)
                if page_text.strip():
                    ocr_pages.append(page_text)
            return "\n".join(ocr_pages)
        except Exception as e:
            print(f"[PDF Extract Error]: {e}")
            return ""

    # Image files (.png, .jpg, .jpeg, .webp, etc.)
    return ocr_image_bytes(file_bytes)

# -------------------------------------------------------------
# 4. Local Ollama (Qwen) Invoice Data Extraction & Heuristic Fallback
# -------------------------------------------------------------
async def check_ollama_status() -> Dict[str, Any]:
    """
    Checks AI provider status:
    1. Cloudflare Workers AI (if CLOUDFLARE_API_TOKEN & CLOUDFLARE_ACCOUNT_ID are configured)
    2. Local Ollama (if running on OLLAMA_BASE_URL)
    """
    cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    cf_model = os.environ.get("CF_MODEL", "@cf/qwen/qwen2.5-7b-instruct")

    if cf_token and cf_account:
        return {
            "online": True,
            "provider": "cloudflare",
            "models": [cf_model],
            "active_model": cf_model
        }

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                qwen_models = [m for m in models if "qwen" in m.lower()]
                selected = qwen_models[0] if qwen_models else (models[0] if models else "qwen2.5:7b")
                return {"online": True, "provider": "ollama", "models": models, "active_model": selected}
    except Exception:
        pass
    return {"online": False, "provider": "none", "models": [], "active_model": "qwen2.5:7b"}


def heuristic_parse_invoice(raw_text: str) -> Dict[str, Any]:
    """
    Smart parser to extract every single point/line item and total.
    Handles numbered items (1) ..., 2) ...), tabular lines, and standard invoice layouts.
    """
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

    # 1. Invoice / Bill Number (Target specifically numbers like Bill No. 287)
    inv_number = "INV-001"
    bill_m = re.search(r'(?:bill\s*(?:no|number|#)?|inv\s*(?:no|number|#)?|invoice\s*(?:no|number|#))\s*[:.\s]*([A-Za-z0-9\-_/]+)', raw_text, re.I)
    if bill_m:
        val = bill_m.group(1).strip()
        # Avoid picking up header words like 'invoice' or 'samsuddin' as number
        if any(c.isdigit() for c in val):
            inv_number = val
        else:
            digit_m = re.search(r'\b(?:bill|inv|invoice)[^\d]*(\d+)', raw_text, re.I)
            if digit_m:
                inv_number = digit_m.group(1)

    # 2. Dates
    date_matches = re.findall(r'\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b', raw_text)
    issue_date = date_matches[0] if date_matches else ""
    due_date = date_matches[1] if len(date_matches) > 1 else ""

    # 3. Vendor extraction
    company_name = "Vendor / Business"
    for line in lines[:5]:
        low = line.lower()
        if not any(k in low for k in ["invoice", "bill", "date", "pan", "phone", "specialist"]):
            if len(line) > 3 and not line[0].isdigit():
                company_name = line
                break

    # 4. Customer extraction
    customer_name = "Client"
    cust_m = re.search(r'(?:m/s\.?|to:|billed to:|client:)\s*([^\n\r,]+)', raw_text, re.I)
    if cust_m:
        customer_name = cust_m.group(1).strip()
    else:
        for line in lines[3:10]:
            if "pvt" in line.lower() or "ltd" in line.lower() or "logistics" in line.lower():
                customer_name = line.strip(" -:–—")
                break

    # 5. Extract ALL points / line items (e.g. 1) ..., 2) ...)
    extracted_items = []
    
    # Check if table headers exist in document
    has_table_headers = any(any(h in line.lower() for h in ['sr. no', 'sr.no', 'particulars', 'item / description']) for line in lines)
    in_table_section = not has_table_headers

    for line in lines:
        low = line.lower()
        if not in_table_section:
            if any(h in low for h in ['sr. no', 'sr.no', 'particulars', 'item / description', 'qty pcs']):
                in_table_section = True
            continue

        if has_table_headers and any(stop in low for stop in ['rupees in word', 'rupeesin', 'receiver', 'for samsuddin', 'grand total']):
            in_table_section = False
            break

        # Ignore obvious contact/header/footer keywords
        if any(ign in low for ign in ['phone', 'mobile', 'pan no', 'godown', 'signature', 'gstin']):
            continue

        # Match numbered item: e.g. "1) ...", "2. ...", "3 - ...", "5> ..."
        num_row_m = re.match(r'^(?:\(?\s*(\d{1,2})\s*[\)>.\-–—]\s*)(.+)', line)
        if num_row_m:
            row_idx = num_row_m.group(1)
            content = num_row_m.group(2).strip()

            # Clean trailing paise notations: e.g. '- 00', '- oo', ' 00', ' 0', '- 00b'
            clean_content = re.sub(r'[\s\-–—]+(?:00b?|oo|0|w)$', '', content, flags=re.I).strip()
            clean_content = clean_content.rstrip(' -–—')
            
            # Find all numbers in the row
            nums = [float(x) for x in re.findall(r'\b\d+(?:\.\d+)?\b', clean_content)]
            if nums:
                amt = nums[-1]
                rate = nums[-1]
                qty = 1.0

                if len(nums) >= 2:
                    a, b = nums[-2], nums[-1]
                    if a > 0 and b >= a:
                        ratio = round(b / a, 2)
                        if abs(ratio - round(ratio)) < 0.05 and 1.0 <= ratio <= 50.0:
                            qty = float(round(ratio))
                            rate = a
                            amt = b
                        else:
                            amt = b
                            rate = a
                            qty = 1.0
                    elif a <= 50 and b > 50:
                        qty = a
                        amt = b
                        rate = amt / qty if qty > 0 else amt

                if len(nums) >= 3:
                    q_cand, r_cand, a_cand = nums[-3], nums[-2], nums[-1]
                    if r_cand > 0 and abs(a_cand - (q_cand * r_cand)) < 1.0:
                        qty = q_cand
                        rate = r_cand
                        amt = a_cand
                    elif r_cand > 0 and abs(a_cand / r_cand - round(a_cand / r_cand)) < 0.05:
                        qty = float(round(a_cand / r_cand))
                        rate = r_cand
                        amt = a_cand

                desc = re.sub(r'[\d\.\-_–—\s]+$', '', clean_content).strip() or clean_content
                desc = re.sub(r'\s*\d+\s*(?:set|pcs|nos|kg|units?)?$', '', desc, flags=re.I).strip()

                if amt < 50000:
                    extracted_items.append({
                        "description": desc or f"Line Item #{len(extracted_items)+1}",
                        "quantity": qty,
                        "unit_price": rate,
                        "amount": amt
                    })
                continue

        # Non-numbered rows that end with an amount
        parts = line.split()
        if len(parts) >= 2 and parts[-1].replace('.', '', 1).isdigit():
            amt = float(parts[-1])
            if not any(k in low for k in ["total", "phone", "date", "bill", "pan", "m/s", "nagar", "rupees", "subtotal", "amount"]):
                desc = " ".join(parts[:-1]).strip(" -:–—")
                # Filter out phone numbers or tiny text
                if len(desc) > 3 and 10 < amt < 50000 and len(parts[-1]) < 8:
                    extracted_items.append({
                        "description": desc,
                        "quantity": 1.0,
                        "unit_price": amt,
                        "amount": amt
                    })

    # 6. Total Extraction
    total_m = re.search(r'(?:total|grand total|net amount|amount)\s*[:.\s-]*([0-9,]+(?:\.[0-9]{2})?)', raw_text, re.I)
    total_val = float(total_m.group(1).replace(',', '')) if total_m else 0.0

    # If no line items parsed, generate from total
    if not extracted_items:
        extracted_items.append({
            "description": "Invoice Particulars & Services",
            "quantity": 1.0,
            "unit_price": total_val if total_val > 0 else 100.0,
            "amount": total_val if total_val > 0 else 100.0
        })

    currency = "₹" if any(k in raw_text.lower() for k in ["rs", "rupee", "pan no", "mumbai", "gstin", "pvt", "logistics"]) else "$"

    return {
        "invoice_number": inv_number,
        "company_name": company_name[:50],
        "company_email": "",
        "customer_name": customer_name[:50],
        "customer_email": "",
        "issue_date": issue_date,
        "due_date": due_date,
        "payment_terms": "Due on Receipt",
        "tax_rate": 0.0,
        "currency": currency,
        "items": extracted_items,
        "notes": f"Extracted {len(extracted_items)} points from document.",
        "status": "PAID"
    }


async def extract_invoice_with_ai(raw_text: str) -> Dict[str, Any]:
    """
    Sends clean OCR text to local Ollama Qwen for JSON extraction.
    Instructs the AI model to extract ALL points/rows without skipping any,
    then recalculates and verifies totals.
    """
    if not raw_text or not raw_text.strip():
        return {
            "success": False,
            "error": "No readable text could be recognized from the image or document. Please ensure the image is clear.",
            "data": heuristic_parse_invoice("")
        }

    ollama_info = await check_ollama_status()
    
    if not ollama_info["online"]:
        parsed = heuristic_parse_invoice(raw_text)
        calc = calculate_invoice_totals(parsed["items"], parsed["tax_rate"])
        parsed.update(calc)
        return {
            "success": True,
            "ai_used": False,
            "message": f"Extracted {len(parsed['items'])} items using OCR parser (Ollama offline).",
            "data": parsed,
            "raw_text_snippet": raw_text[:800]
        }

    model = ollama_info["active_model"]

    prompt = f"""You are an expert invoice processing AI. Read the text extracted from this invoice/bill document.
CRITICAL: You MUST extract EVERY SINGLE numbered point, row, or item from the particulars table. Do NOT skip, omit, or summarize any item.

CRITICAL QUANTITY & RATE RULES:
1. The mathematical equation MUST ALWAYS HOLD TRUE: Quantity = Amount / Rate (or Amount = Quantity * Rate).
   - If Rate is 230 and Amount is 460, Quantity MUST BE 2.0 (because 460 / 230 = 2).
   - If Rate is 450 and Amount is 900, Quantity MUST BE 2.0 (because 900 / 450 = 2).
   - If Rate is 195 and Amount is 390, Quantity MUST BE 2.0 (because 390 / 195 = 2).
   - If Rate is 240 and Amount is 240, Quantity is 1.0 (because 240 / 240 = 1).
   - If Rate is 2300 and Amount is 2300, Quantity is 1.0.
2. NEVER set Quantity to the row number (#1, #2, #3, etc.) or to the Rate. Quantity is the unit count (e.g. 1.0 or 2.0).

Return ONLY a valid JSON object matching this exact schema:
{{
  "invoice_number": "string (e.g. 287 or INV-001)",
  "company_name": "string (vendor / supplier / company at the top)",
  "company_email": "string",
  "customer_name": "string (client / customer / M/s name)",
  "customer_email": "string",
  "issue_date": "string (e.g. 28/10/2024 or 2024-10-28)",
  "due_date": "string",
  "payment_terms": "string",
  "tax_rate": 0.0,
  "currency": "string (use ₹ if Indian Rupees or Rs, or $ if USD)",
  "items": [
    {{
      "description": "string (full item name / description / work done)",
      "quantity": 1.0,
      "unit_price": 100.0,
      "amount": 100.0
    }}
  ],
  "total": 0.0,
  "notes": "string (e.g. amount in words or special notes)",
  "status": "PAID"
}}

Rules:
1. Every row/point listed in the invoice table (1, 2, 3, 4, 5, etc.) must be a separate entry in the "items" array.
2. For each item, provide description, quantity, and unit_price (rate).
3. The final stated total on the bill (e.g. 7226) must be captured in "total".
4. Output RAW JSON ONLY. No markdown ticks (no ```json), no conversation.

Invoice Document Text:
\"\"\"
{raw_text[:4000]}
\"\"\"
"""

    provider = ollama_info.get("provider", "ollama")

    # 1. Cloudflare Workers AI Call
    if provider == "cloudflare":
        cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
        cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        cf_model = os.environ.get("CF_MODEL", "@cf/qwen/qwen2.5-7b-instruct")
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/run/{cf_model}"
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {cf_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messages": [
                            {"role": "system", "content": "You are an expert invoice data extraction assistant. Return ONLY a valid JSON object matching the requested schema. No conversation, no markdown codeblocks."},
                            {"role": "user", "content": prompt}
                        ]
                    }
                )

                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get("result", {}).get("response", "")
                    clean_json = re.sub(r'```json\s*', '', result)
                    clean_json = re.sub(r'```\s*', '', clean_json).strip()
                    
                    json_match = re.search(r'\{.*\}', clean_json, re.DOTALL)
                    if json_match:
                        clean_json = json_match.group(0)

                    parsed_data = json.loads(clean_json)

                    if "currency" not in parsed_data:
                        parsed_data["currency"] = "₹" if any(k in raw_text.lower() for k in ["rs", "rupee", "pan no", "mumbai", "pvt"]) else "$"

                    calc = calculate_invoice_totals(
                        parsed_data.get("items", []),
                        parsed_data.get("tax_rate", 0.0)
                    )
                    
                    stated_total = parsed_data.get("total")
                    parsed_data.update(calc)
                    if stated_total and abs(stated_total - calc["total"]) > 0.5:
                        parsed_data["stated_total"] = stated_total

                    return {
                        "success": True,
                        "ai_used": True,
                        "model": f"Cloudflare ({cf_model.split('/')[-1]})",
                        "message": f"Successfully extracted all {len(calc['items'])} points with Cloudflare Workers AI ({cf_model})",
                        "data": parsed_data,
                        "raw_text_snippet": raw_text[:800]
                    }
        except Exception as e:
            print(f"[Cloudflare Workers AI Call Exception]: {type(e).__name__} -> {repr(e)}")

    # 2. Local Ollama Qwen Call
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1
                    }
                }
            )

            if resp.status_code == 200:
                result = resp.json().get("response", "")
                clean_json = re.sub(r'```json\s*', '', result)
                clean_json = re.sub(r'```\s*', '', clean_json).strip()
                
                json_match = re.search(r'\{.*\}', clean_json, re.DOTALL)
                if json_match:
                    clean_json = json_match.group(0)

                parsed_data = json.loads(clean_json)

                # Ensure currency is carried through
                if "currency" not in parsed_data:
                    parsed_data["currency"] = "₹" if any(k in raw_text.lower() for k in ["rs", "rupee", "pan no", "mumbai", "pvt"]) else "$"

                # Recalculate and verify math with Python
                calc = calculate_invoice_totals(
                    parsed_data.get("items", []),
                    parsed_data.get("tax_rate", 0.0)
                )
                
                stated_total = parsed_data.get("total")
                parsed_data.update(calc)
                if stated_total and abs(stated_total - calc["total"]) > 0.5:
                    parsed_data["stated_total"] = stated_total

                return {
                    "success": True,
                    "ai_used": True,
                    "model": model,
                    "message": f"Successfully extracted all {len(calc['items'])} points with local Ollama ({model})",
                    "data": parsed_data,
                    "raw_text_snippet": raw_text[:800]
                }
    except Exception as e:
        print(f"[Ollama Call Exception]: {type(e).__name__} -> {repr(e)}")

    # Fallback to heuristic parser
    parsed = heuristic_parse_invoice(raw_text)
    calc = calculate_invoice_totals(parsed["items"], parsed["tax_rate"])
    parsed.update(calc)
    return {
        "success": True,
        "ai_used": False,
        "message": f"Extracted {len(calc['items'])} points using smart rule-based parser",
        "data": parsed,
        "raw_text_snippet": raw_text[:800]
    }

# -------------------------------------------------------------
# 5. Line Item AI Description Generator
# -------------------------------------------------------------
async def generate_item_description(title: str) -> str:
    """
    Uses Cloudflare Workers AI or local Ollama to write a concise line item description.
    """
    ollama_info = await check_ollama_status()
    if not ollama_info["online"]:
        return f"Professional {title} services and deliverable package."

    model = ollama_info["active_model"]
    prompt = f"Write a single concise, professional invoice line item description (under 15 words) for: '{title}'. Return ONLY the description, nothing else."

    # Cloudflare Workers AI
    if ollama_info.get("provider") == "cloudflare":
        cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
        cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        cf_model = os.environ.get("CF_MODEL", "@cf/qwen/qwen2.5-7b-instruct")
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/run/{cf_model}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {cf_token}"},
                    json={"messages": [{"role": "user", "content": prompt}]}
                )
                if resp.status_code == 200:
                    return resp.json().get("result", {}).get("response", "").strip().strip('"').strip("'")
        except Exception:
            pass

    # Local Ollama
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3}
                }
            )
            if resp.status_code == 200:
                desc = resp.json().get("response", "").strip().strip('"').strip("'")
                return desc
    except Exception:
        pass
    
    return f"Professional {title} delivery and implementation."
