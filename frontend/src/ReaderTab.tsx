import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, ArrowRight, Loader2, AlertTriangle, Cpu, Save, Download, Check } from 'lucide-react';
import { uploadAndExtractInvoice, saveInvoice, downloadInvoicePdf } from './api';
import type { ExtractedData, ExtractionResponse, InvoiceCreatePayload } from './types';

interface ReaderTabProps {
  onImportToGenerator: (data: ExtractedData) => void;
  onInvoiceSaved?: () => void;
}

export const ReaderTab: React.FC<ReaderTabProps> = ({ onImportToGenerator, onInvoiceSaved }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const autoSave = true;
  const [saving, setSaving] = useState<boolean>(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const saveCurrentExtractedInvoice = async (data: ExtractedData, andDownloadPdf: boolean = false) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const invNum = data.invoice_number?.trim() || `INV-${Date.now().toString().slice(-4)}`;
      const payload: InvoiceCreatePayload = {
        invoice_number: invNum,
        company_name: data.company_name?.trim() || 'Vendor',
        company_email: data.company_email || '',
        payment_terms: data.payment_terms || 'Due on Receipt',
        customer_name: data.customer_name?.trim() || 'Client',
        customer_email: data.customer_email || '',
        issue_date: data.issue_date || new Date().toISOString().split('T')[0],
        due_date: data.due_date || '',
        tax_rate: data.tax_rate || 0,
        currency: data.currency || '₹',
        notes: data.notes || '',
        status: data.status || 'PAID',
        items: (data.items || []).map((it) => ({
          description: it.description || 'Item',
          quantity: it.quantity || 1.0,
          unit_price: it.unit_price || 0.0,
          amount: (it.quantity || 1.0) * (it.unit_price || 0.0),
        })),
      };

      const res = await saveInvoice(payload);
      setSavedInvoiceId(res.id);
      setSaveSuccessMsg(`Invoice #${invNum} saved successfully to database!`);
      if (onInvoiceSaved) {
        onInvoiceSaved();
      }

      if (andDownloadPdf && res.id) {
        await downloadInvoicePdf(res.id, invNum);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save invoice to database.');
    } finally {
      setSaving(false);
    }
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setErrorMessage(null);
    setExtractionResult(null);
    setSavedInvoiceId(null);
    setSaveSuccessMsg(null);

    try {
      const res = await uploadAndExtractInvoice(file, autoSave);
      setExtractionResult(res);

      if (res.success && res.data) {
        if (res.saved && res.saved_invoice_id) {
          setSavedInvoiceId(res.saved_invoice_id);
          const invNum = res.saved_invoice_number || res.data.invoice_number || 'INV';
          setSaveSuccessMsg(`Invoice #${invNum} automatically saved to database!`);
          if (onInvoiceSaved) {
            onInvoiceSaved();
          }
        } else if (autoSave) {
          await saveCurrentExtractedInvoice(res.data, false);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Drag & Drop Hero Box */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`bg-white brutal-border brutal-shadow p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'bg-[#FFF7E8] scale-[1.01]' : 'hover:bg-[#FAF8F5]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-16 h-16 bg-[#FFF2DE] brutal-border flex items-center justify-center mx-auto text-[#1E3F30]">
            {loading ? (
              <Loader2 size={32} className="animate-spin text-[#1E3F30]" />
            ) : (
              <UploadCloud size={32} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">
              {loading ? 'Processing Document with AI...' : 'Drag & Drop Any Invoice Here'}
            </h3>
            <p className="text-xs text-gray-600 font-medium mt-1">
              Supports PDF documents, scanned receipts, PNG, or JPG invoices
            </p>
          </div>

          <div className="pt-2">
            <span className="inline-block px-4 py-1.5 bg-[#1E3F30] text-white text-xs font-extrabold uppercase brutal-border-sm">
              {loading ? 'Running OCR & Ollama Qwen...' : 'Browse Computer'}
            </span>
          </div>

          {fileName && !loading && (
            <p className="text-xs font-mono font-bold bg-[#EFECE6] p-1.5 brutal-border-sm inline-block">
              Selected: {fileName}
            </p>
          )}
        </div>
      </div>


      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-[#E3F2E1] brutal-border brutal-shadow-sm text-[#1E3F30] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} className="shrink-0 text-[#1E3F30]" />
            <span className="text-xs font-black uppercase tracking-wide">
              {saveSuccessMsg}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('saved-invoices');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-xs font-black underline uppercase hover:text-black"
          >
            View in Saved Invoices ↓
          </button>
        </div>
      )}

      {/* Error display */}
      {errorMessage && (
        <div className="p-4 bg-[#FFE2DE] brutal-border brutal-shadow-sm text-red-900 flex items-center space-x-2">
          <AlertTriangle size={20} className="shrink-0" />
          <span className="text-sm font-bold">{errorMessage}</span>
        </div>
      )}

      {/* 2. Extracted Data Result Card */}
      {extractionResult && extractionResult.data && (
        <div className="bg-white brutal-border brutal-shadow p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
            <div className="flex items-center space-x-2">
              <span className="bg-[#E3F2E1] text-[#1E3F30] px-2.5 py-1 text-xs font-extrabold uppercase brutal-border-sm flex items-center space-x-1">
                <CheckCircle2 size={14} />
                <span>Extracted Successfully</span>
              </span>

              {extractionResult.ai_used ? (
                <span className="bg-[#D1E8FA] text-blue-900 px-2 py-0.5 text-xs font-bold uppercase brutal-border-sm flex items-center space-x-1">
                  <Cpu size={12} />
                  <span>{extractionResult.model?.includes('Cloudflare') ? extractionResult.model : `Ollama (${extractionResult.model || 'qwen2.5:7b'})`}</span>
                </span>
              ) : (
                <span className="bg-[#FFF2DE] text-amber-900 px-2 py-0.5 text-xs font-bold uppercase brutal-border-sm">
                  Smart OCR Fallback
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => saveCurrentExtractedInvoice(extractionResult.data, false)}
                disabled={saving}
                className={`px-3 py-2 text-xs font-black uppercase tracking-wider brutal-border brutal-shadow-sm brutal-shadow-hover flex items-center space-x-1.5 ${
                  savedInvoiceId ? 'bg-[#E3F2E1] text-[#1E3F30]' : 'bg-white text-black'
                }`}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : savedInvoiceId ? (
                  <Check size={14} />
                ) : (
                  <Save size={14} />
                )}
                <span>{saving ? 'Saving...' : savedInvoiceId ? '✓ Saved to DB' : '💾 Save to DB'}</span>
              </button>

              {savedInvoiceId && (
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(savedInvoiceId, extractionResult.data.invoice_number || 'INV')}
                  className="px-3 py-2 bg-white text-black text-xs font-black uppercase tracking-wider brutal-border brutal-shadow-sm brutal-shadow-hover flex items-center space-x-1.5"
                >
                  <Download size={14} />
                  <span>PDF</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onImportToGenerator(extractionResult.data)}
                className="px-3.5 py-2 bg-[#FF8577] text-black text-xs font-black uppercase tracking-wider brutal-border brutal-shadow-sm brutal-shadow-hover flex items-center space-x-1.5"
              >
                <span>⚡ Load into Generator</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Quick Extracted Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-3 brutal-border">
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500">Invoice Number</span>
              <span className="font-mono font-bold text-sm">
                {extractionResult.data.invoice_number || 'INV-EXTRACTED'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500">Vendor / Company</span>
              <span className="font-bold text-sm truncate block">
                {extractionResult.data.company_name || '-'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500">Client / Customer</span>
              <span className="font-bold text-sm truncate block">
                {extractionResult.data.customer_name || '-'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-gray-500">Calculated Total</span>
              <span className="font-mono font-black text-base text-[#1E3F30]">
                ${(extractionResult.data.total ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Extracted Line Items & Complete Points Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Extracted Line Items ({extractionResult.data.items?.length || 0} Points)
                </h4>
                <span className="text-[11px] text-gray-600 font-medium">All itemized rows from document</span>
              </div>
              <span className="text-xs font-bold font-mono bg-[#EFECE6] px-2 py-0.5 brutal-border-sm">
                Currency: {extractionResult.data.currency || '₹'}
              </span>
            </div>

            <div className="overflow-x-auto brutal-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EFECE6] border-b-2 border-black text-[11px] font-black uppercase">
                    <th className="p-2 border-r-2 border-black text-center w-12">#</th>
                    <th className="p-2 border-r-2 border-black">Point / Particulars</th>
                    <th className="p-2 border-r-2 border-black text-center w-20">Qty</th>
                    <th className="p-2 border-r-2 border-black text-right w-28">Rate / Price</th>
                    <th className="p-2 text-right w-28">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {extractionResult.data.items && extractionResult.data.items.length > 0 ? (
                    extractionResult.data.items.map((it, idx) => {
                      const curr = extractionResult.data.currency || '₹';
                      const itemTotal = (it.quantity || 1) * (it.unit_price || 0);
                      return (
                        <tr key={idx} className="border-b border-black text-xs hover:bg-[#FAF8F5]">
                          <td className="p-2 border-r-2 border-black text-center font-mono font-bold bg-[#F4F0E8]">
                            #{idx + 1}
                          </td>
                          <td className="p-2 border-r-2 border-black font-semibold text-gray-900">
                            {it.description}
                          </td>
                          <td className="p-2 border-r-2 border-black text-center font-mono font-bold">
                            {it.quantity}
                          </td>
                          <td className="p-2 border-r-2 border-black text-right font-mono">
                            {curr}{it.unit_price.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-extrabold text-[#1E3F30]">
                            {curr}{itemTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-xs text-gray-500 italic">
                        No line items parsed. General invoice amounts will be transferred.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Complete Totals Summary Card */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 bg-[#F7F5F0] p-4 brutal-border">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-gray-600 block">Calculation Verification</span>
                <p className="text-xs font-medium text-gray-700">
                  Total of all {extractionResult.data.items?.length || 0} line items verified by Python calculation engine.
                </p>
                {extractionResult.data.notes && (
                  <p className="text-[11px] font-mono text-gray-600 mt-1">
                    Notes: {extractionResult.data.notes}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-72 space-y-2 bg-white p-3 brutal-border">
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-mono">
                    {extractionResult.data.currency || '₹'}{(extractionResult.data.subtotal ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-700">
                  <span>Tax ({(extractionResult.data.tax_rate ?? 0)}%):</span>
                  <span className="font-mono">
                    {extractionResult.data.currency || '₹'}{(extractionResult.data.tax_amount ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="border-t-2 border-black pt-2 flex justify-between items-center">
                  <span className="text-xs font-black uppercase">GRAND TOTAL:</span>
                  <span className="text-lg font-mono font-black bg-[#1E3F30] text-white px-2.5 py-0.5 brutal-border-sm">
                    {extractionResult.data.currency || '₹'}{(extractionResult.data.total ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw snippet preview */}
          {extractionResult.raw_text_snippet && (
            <div className="pt-2">
              <span className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Raw Document Text Preview</span>
              <pre className="text-[11px] bg-[#F4F0E8] p-2 brutal-border font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                {extractionResult.raw_text_snippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
