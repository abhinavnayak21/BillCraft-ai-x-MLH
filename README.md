# 🧾 InvoiceCraft AI

> **AI-powered invoice generator & reader built for freelancers and small businesses.**  
> Powered by local **Ollama (Qwen)** for automated invoice data extraction and line-item enhancement, with strict server-side Python math validation and branded PDF export.

---

## 🎨 Visual Aesthetics & Design

Built directly inspired by the retro-neobrutalist / Hacktoberfest aesthetic:
- **Canvas / Background:** Retro warm cream (`#F4F0E8` / `#EFECE6`).
- **Header:** Deep forest green (`#1E3F30`) with crisp high-contrast branding.
- **Accents:** Coral/salmon action buttons (`#FF8577`) with hard offset black shadows (`4px 4px 0 #000`).
- **Pill Badges:** Pastel blue (`#D1E8FA`) and pastel salmon (`#FFD5CE`) with 2px borders.
- **Invoice Cards:** Date badge box on the left (`14 OCT`), clean bold typography, and interactive hover micro-animations.

---

## 🚀 Key Features

1. **Invoice Generator:**
   - Persistent inline business profile (`Company Name`, `Email`, `Tax Rate %`, `Payment Terms`) saved automatically in your browser's `localStorage`.
   - Dynamic line items with auto-calculated subtotals, tax, and grand totals.
   - **✨ AI Item Description:** One-click enhancement of product/service descriptions using local Ollama.
   - **High-Resolution PDF Generation:** Download professional branded PDF invoices matching the retro design theme.

2. **Invoice Reader (OCR + Local AI):**
   - **Quick Drag & Drop:** Drop any PDF document, scanned receipt, PNG, or JPG invoice.
   - **Document OCR:** Uses `PyMuPDF` for fast vector PDF text extraction and `Tesseract` for scanned images.
   - **Local Ollama Extraction:** Sends raw text to your local **Qwen** model to extract vendor, client, dates, line items, and totals into structured JSON.
   - **Graceful Offline Fallback:** If Ollama is offline or unavailable, automatically falls back to an intelligent regex parser so extraction always works.
   - **1-Click Import:** Immediately transfer extracted details into the Generator for editing or saving.

3. **Financial Math Validation:**
   - Python-side calculation service guarantees accurate rounding, subtotaling, tax computation, and grand totals before any record is saved to SQLite.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, pnpm
- **Backend:** Python 3, FastAPI, SQLite, SQLAlchemy, Pydantic, ReportLab
- **OCR & Document Processing:** PyMuPDF (`fitz`), Pillow, Tesseract OCR
- **Local AI:** Ollama with open-weight models (`qwen2.5:latest` or `qwen2.5:7b`)

---

## 📦 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **pnpm** (`npm install -g pnpm`)
- *(Optional)* **Ollama** running locally:
  ```bash
  ollama run qwen2.5
  ```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The FastAPI backend will start at **http://127.0.0.1:8000**.  
API docs are available at **http://127.0.0.1:8000/docs**.

---

### 3. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Install packages with pnpm
pnpm install

# Start Vite development server
pnpm dev
```

Open your browser at **http://127.0.0.1:5173/**.

---

## 🧪 Automated Tests

Run backend math validation and PDF generation tests:

```bash
cd backend
.\venv\Scripts\pytest test_backend.py -v
```

---

## 🔒 Privacy & Local AI Guarantee
- All invoice data is stored locally in `invoices.db` (SQLite).
- AI extraction runs directly on your machine through Ollama at `localhost:11434`. No data is ever sent to third-party cloud APIs.
