# 🧾 BillCraft AI

> **AI-powered invoice generator & reader built for freelancers and small businesses.**  
> Powered by local **Ollama (Qwen)** for automated invoice data extraction and line-item enhancement, with strict server-side Python math validation and branded PDF export.

---

## 🚀 Key Features

1. **Invoice Generator:**
   - Persistent inline business profile (`Company Name`, `Email`, `Tax Rate %`, `Payment Terms`) saved automatically in your browser's `localStorage`.
   - Dynamic line items with auto-calculated subtotals, tax, and grand totals.
   - **✨ AI Item Description:** One-click enhancement of product/service descriptions using local Ollama.
   - **High-Resolution PDF Generation:** Download professional branded PDF invoices matching the theme.

2. **Invoice Reader (OCR + Local AI):**
   - **Quick Drag & Drop:** Drop any PDF document, scanned receipt, PNG, or JPG invoice.
   - **Document OCR:** Uses `RapidOCR` and `PyMuPDF` for fast vector and scanned document text extraction.
   - **Local Ollama Extraction:** Sends text to your local **Qwen** model (`qwen2.5:7b`) to extract vendor, client, dates, line items, and totals into structured JSON.
   - **Graceful Fallback:** If Ollama is offline, automatically falls back to an intelligent rule-based parser so extraction always works.
   - **Auto-Save to Database:** Extracted invoices are automatically verified and saved into SQLite.
   - **1-Click Import:** Immediately transfer extracted details into the Generator for editing or downloading PDF.

3. **Financial Math Validation:**
   - Python-side calculation service guarantees accurate rounding, subtotaling, tax computation, and grand totals before any record is saved to SQLite.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, pnpm
- **Backend:** Python 3, FastAPI, SQLite, SQLAlchemy, Pydantic, ReportLab
- **OCR & Document Processing:** RapidOCR, PyMuPDF (`fitz`), Pillow
- **Local AI:** Ollama (`qwen2.5:7b`)

---

## 📦 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **pnpm** (`npm install -g pnpm`)
- **Ollama** running locally with Qwen:
  ```bash
  ollama run qwen2.5:7b
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

## 🔒 Privacy & Local AI Guarantee
- All invoice data is stored locally in `invoices.db` (SQLite).
- AI extraction runs directly on your machine through Ollama at `localhost:11434`. No data is ever sent to third-party cloud APIs.
