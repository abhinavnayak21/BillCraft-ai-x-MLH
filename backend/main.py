import os
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from database import engine, get_db, Base
from models import Invoice, LineItem
from services import (
    calculate_invoice_totals,
    generate_pdf,
    extract_text_from_file,
    extract_invoice_with_ai,
    check_ollama_status,
    generate_item_description,
)

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BillCraft AI API",
    description="FastAPI Backend for Invoice Generation & Local AI Reader",
    version="1.0.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class ItemSchema(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    amount: Optional[float] = 0.0

class InvoiceCreate(BaseModel):
    invoice_number: str
    company_name: str = "My Company"
    company_email: str = ""
    payment_terms: str = "Due on Receipt"
    customer_name: str = ""
    customer_email: str = ""
    issue_date: str = ""
    due_date: str = ""
    tax_rate: float = 0.0
    notes: Optional[str] = ""
    status: str = "PAID"
    items: List[ItemSchema]

class DescribeRequest(BaseModel):
    title: str


# -------------------------------------------------------------
# Startup Event: Seed 1 sample invoice if DB is empty
# -------------------------------------------------------------
@app.on_event("startup")
def startup_populate_sample():
    db = next(get_db())
    try:
        count = db.query(Invoice).count()
        if count == 0:
            sample_items = [
                {"description": "Full-Stack Web Application Development", "quantity": 1, "unit_price": 1800.0},
                {"description": "AI Local Model (Qwen) Integration & Prompt Engineering", "quantity": 1, "unit_price": 650.0},
                {"description": "UI/UX Styling & Neobrutalist Component System", "quantity": 1, "unit_price": 400.0},
            ]
            calc = calculate_invoice_totals(sample_items, 8.0)
            
            sample_inv = Invoice(
                invoice_number="INV-2026-001",
                company_name="InvoiceCraft Studios",
                company_email="hello@invoicecraft.ai",
                payment_terms="Net 30",
                customer_name="Acme Global Corporation",
                customer_email="billing@acmeglobal.com",
                issue_date="2026-10-14",
                due_date="2026-11-14",
                tax_rate=calc["tax_rate"],
                subtotal=calc["subtotal"],
                tax_amount=calc["tax_amount"],
                total=calc["total"],
                notes="Thank you for partnering with us! Payment via wire transfer or ACH.",
                status="PAID"
            )
            db.add(sample_inv)
            db.commit()
            db.refresh(sample_inv)

            for it in calc["items"]:
                line_item = LineItem(
                    invoice_id=sample_inv.id,
                    description=it["description"],
                    quantity=it["quantity"],
                    unit_price=it["unit_price"],
                    amount=it["amount"]
                )
                db.add(line_item)
            db.commit()
    finally:
        db.close()


# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@app.get("/api/ollama/status")
async def get_ollama_status():
    """Returns local Ollama health status and available models"""
    return await check_ollama_status()


@app.get("/api/invoices")
def list_invoices(db: Session = Depends(get_db)):
    """List all saved invoices sorted by ID descending"""
    invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    results = []
    for inv in invoices:
        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "company_name": inv.company_name,
            "company_email": inv.company_email,
            "customer_name": inv.customer_name,
            "customer_email": inv.customer_email,
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "payment_terms": inv.payment_terms,
            "tax_rate": inv.tax_rate,
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "total": inv.total,
            "notes": inv.notes,
            "status": inv.status,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "items": [
                {
                    "id": it.id,
                    "description": it.description,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                    "amount": it.amount,
                }
                for it in inv.items
            ]
        })
    return results


@app.post("/api/invoices")
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    """Creates and calculates a new invoice with verified math"""
    # Check if invoice number already exists -> update it seamlessly
    existing = db.query(Invoice).filter(Invoice.invoice_number == payload.invoice_number).first()

    raw_items = [it.dict() for it in payload.items]
    calc = calculate_invoice_totals(raw_items, payload.tax_rate)

    if existing:
        existing.company_name = payload.company_name
        existing.company_email = payload.company_email
        existing.payment_terms = payload.payment_terms
        existing.customer_name = payload.customer_name
        existing.customer_email = payload.customer_email
        existing.issue_date = payload.issue_date
        existing.due_date = payload.due_date
        existing.tax_rate = calc["tax_rate"]
        existing.subtotal = calc["subtotal"]
        existing.tax_amount = calc["tax_amount"]
        existing.total = calc["total"]
        existing.notes = payload.notes
        existing.status = payload.status or "PAID"

        # Replace line items
        db.query(LineItem).filter(LineItem.invoice_id == existing.id).delete()
        for it in calc["items"]:
            line_item = LineItem(
                invoice_id=existing.id,
                description=it["description"],
                quantity=it["quantity"],
                unit_price=it["unit_price"],
                amount=it["amount"]
            )
            db.add(line_item)
        db.commit()

        return {
            "success": True,
            "id": existing.id,
            "invoice_number": existing.invoice_number,
            "total": existing.total,
            "message": f"Invoice #{existing.invoice_number} saved & updated successfully!"
        }

    invoice = Invoice(
        invoice_number=payload.invoice_number,
        company_name=payload.company_name,
        company_email=payload.company_email,
        payment_terms=payload.payment_terms,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        tax_rate=calc["tax_rate"],
        subtotal=calc["subtotal"],
        tax_amount=calc["tax_amount"],
        total=calc["total"],
        notes=payload.notes,
        status=payload.status or "PAID"
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    for it in calc["items"]:
        line_item = LineItem(
            invoice_id=invoice.id,
            description=it["description"],
            quantity=it["quantity"],
            unit_price=it["unit_price"],
            amount=it["amount"]
        )
        db.add(line_item)
    db.commit()

    return {
        "success": True,
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "total": invoice.total,
        "message": f"Invoice {invoice.invoice_number} saved successfully!"
    }


@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Deletes an invoice and its associated line items"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    
    db.delete(inv)
    db.commit()
    return {"success": True, "message": f"Invoice #{inv.invoice_number} deleted."}


@app.get("/api/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """Generates and streams a high-resolution branded PDF invoice"""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    invoice_data = {
        "invoice_number": inv.invoice_number,
        "company_name": inv.company_name,
        "company_email": inv.company_email,
        "customer_name": inv.customer_name,
        "customer_email": inv.customer_email,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "payment_terms": inv.payment_terms,
        "tax_rate": inv.tax_rate,
        "subtotal": inv.subtotal,
        "tax_amount": inv.tax_amount,
        "total": inv.total,
        "notes": inv.notes,
        "status": inv.status,
        "items": [
            {
                "description": it.description,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "amount": it.amount,
            }
            for it in inv.items
        ]
    }

    pdf_buffer = generate_pdf(invoice_data)
    filename = f"Invoice_{inv.invoice_number}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/reader/extract")
async def extract_invoice_endpoint(
    file: UploadFile = File(...),
    auto_save: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Accepts PDF or Image upload, extracts text with OCR,
    and structures it using local Ollama (Qwen) with graceful fallback.
    If auto_save is True, automatically saves the extracted invoice to SQLite database.
    """
    contents = await file.read()
    raw_text = extract_text_from_file(contents, file.filename)
    
    extraction_result = await extract_invoice_with_ai(raw_text)

    if auto_save and extraction_result.get("success") and extraction_result.get("data"):
        data = extraction_result["data"]
        raw_inv_no = str(data.get("invoice_number", "")).strip()
        inv_number = raw_inv_no if raw_inv_no else f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        data["invoice_number"] = inv_number

        company_name = (data.get("company_name") or "Vendor").strip()
        customer_name = (data.get("customer_name") or "Client").strip()
        issue_date = data.get("issue_date") or datetime.utcnow().strftime("%Y-%m-%d")

        existing = db.query(Invoice).filter(Invoice.invoice_number == inv_number).first()
        if existing:
            inv_record = existing
            inv_record.company_name = company_name
            inv_record.company_email = data.get("company_email", "")
            inv_record.customer_name = customer_name
            inv_record.customer_email = data.get("customer_email", "")
            inv_record.issue_date = issue_date
            inv_record.due_date = data.get("due_date", "")
            inv_record.payment_terms = data.get("payment_terms", "Due on Receipt")
            inv_record.tax_rate = float(data.get("tax_rate", 0.0))
            inv_record.subtotal = float(data.get("subtotal", 0.0))
            inv_record.tax_amount = float(data.get("tax_amount", 0.0))
            inv_record.total = float(data.get("total", 0.0))
            inv_record.notes = data.get("notes", "")
            inv_record.status = data.get("status", "PAID")

            db.query(LineItem).filter(LineItem.invoice_id == inv_record.id).delete()
        else:
            inv_record = Invoice(
                invoice_number=inv_number,
                company_name=company_name,
                company_email=data.get("company_email", ""),
                payment_terms=data.get("payment_terms", "Due on Receipt"),
                customer_name=customer_name,
                customer_email=data.get("customer_email", ""),
                issue_date=issue_date,
                due_date=data.get("due_date", ""),
                tax_rate=float(data.get("tax_rate", 0.0)),
                subtotal=float(data.get("subtotal", 0.0)),
                tax_amount=float(data.get("tax_amount", 0.0)),
                total=float(data.get("total", 0.0)),
                notes=data.get("notes", ""),
                status=data.get("status", "PAID")
            )
            db.add(inv_record)
            db.commit()
            db.refresh(inv_record)

        for it in data.get("items", []):
            qty = float(it.get("quantity", 1.0))
            price = float(it.get("unit_price", 0.0))
            amount = float(it.get("amount", round(qty * price, 2)))
            db.add(LineItem(
                invoice_id=inv_record.id,
                description=it.get("description", "Item"),
                quantity=qty,
                unit_price=price,
                amount=amount
            ))
        db.commit()
        db.refresh(inv_record)

        extraction_result["saved"] = True
        extraction_result["saved_invoice_id"] = inv_record.id
        extraction_result["saved_invoice_number"] = inv_record.invoice_number
        extraction_result["message"] = f"{extraction_result.get('message', 'Extracted')}. Saved to database as Invoice #{inv_record.invoice_number}"

    return extraction_result


@app.post("/api/ai/describe-item")
async def describe_item_endpoint(request: DescribeRequest):
    """Generates a concise professional line item description via local Ollama or Hugging Face"""
    desc = await generate_item_description(request.title)
    return {"description": desc}


# -------------------------------------------------------------
# Static Files & SPA Routing (For Render Single Service Deployment)
# -------------------------------------------------------------
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"message": "BillCraft AI API running"}

