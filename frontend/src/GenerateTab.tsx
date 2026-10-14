import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Sparkles, Download, CheckCircle, AlertCircle } from 'lucide-react';
import type { LineItem, InvoiceCreatePayload, CompanyInfo } from './types';
import { saveInvoice, downloadInvoicePdf, describeLineItem } from './api';

interface GenerateTabProps {
  initialData?: Partial<InvoiceCreatePayload> | null;
  onInvoiceSaved: () => void;
}

const DEFAULT_COMPANY: CompanyInfo = {
  companyName: 'BillCraft Studios',
  companyEmail: 'billing@billcraft.ai',
  taxRate: 0.0,
  paymentTerms: 'Due on Receipt',
  currency: '₹',
};

export const GenerateTab: React.FC<GenerateTabProps> = ({ initialData, onInvoiceSaved }) => {
  // Load company settings from localStorage
  const [company, setCompany] = useState<CompanyInfo>(() => {
    try {
      const saved = localStorage.getItem('invoicecraft_company');
      return saved ? JSON.parse(saved) : DEFAULT_COMPANY;
    } catch {
      return DEFAULT_COMPANY;
    }
  });

  // Invoice Form State
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-002');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState<string>('Payment is due within agreed terms. Thank you for your partnership!');

  const [items, setItems] = useState<LineItem[]>([
    { description: 'Consulting & Implementation Services', quantity: 1, unit_price: 500 },
  ]);

  const [loading, setLoading] = useState<boolean>(false);
  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-save company info to localStorage
  useEffect(() => {
    localStorage.setItem('invoicecraft_company', JSON.stringify(company));
  }, [company]);

  // If initialData is passed (e.g. from Reader extraction)
  useEffect(() => {
    if (initialData) {
      if (initialData.invoice_number) setInvoiceNumber(initialData.invoice_number);
      if (initialData.customer_name) setCustomerName(initialData.customer_name);
      if (initialData.customer_email) setCustomerEmail(initialData.customer_email);
      if (initialData.issue_date) setIssueDate(initialData.issue_date);
      if (initialData.due_date) setDueDate(initialData.due_date);
      if (initialData.status) setStatus(initialData.status);
      if (initialData.notes) setNotes(initialData.notes);
      if (initialData.items && initialData.items.length > 0) {
        setItems(initialData.items);
      }
      if (initialData.company_name) {
        setCompany((prev) => ({
          ...prev,
          companyName: initialData.company_name || prev.companyName,
          currency: initialData.currency || prev.currency || '₹',
        }));
      }
      if (initialData.tax_rate !== undefined) {
        setCompany((prev) => ({ ...prev, taxRate: initialData.tax_rate ?? prev.taxRate }));
      }
      setNotification({
        type: 'success',
        message: `Successfully populated ${initialData.items?.length || 0} line items from extracted invoice!`,
      });
    }
  }, [initialData]);

  // Math Calculations (instant live feedback)
  const curr = company.currency || '₹';
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = subtotal * (company.taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof LineItem, val: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  const handleAiSuggest = async (idx: number) => {
    const currentDesc = items[idx].description.trim();
    if (!currentDesc) {
      setNotification({ type: 'error', message: 'Enter a brief keyword or title to enhance with AI.' });
      return;
    }
    setAiLoadingIdx(idx);
    try {
      const suggested = await describeLineItem(currentDesc);
      handleItemChange(idx, 'description', suggested);
      setNotification({ type: 'success', message: 'AI generated item description!' });
    } catch {
      setNotification({ type: 'error', message: 'Failed to generate AI description.' });
    } finally {
      setAiLoadingIdx(null);
    }
  };

  const handleSaveInvoice = async (andDownloadPdf: boolean = false) => {
    if (!invoiceNumber.trim()) {
      setNotification({ type: 'error', message: 'Invoice number is required.' });
      return;
    }
    if (!customerName.trim()) {
      setNotification({ type: 'error', message: 'Customer name is required.' });
      return;
    }

    setLoading(true);
    setNotification(null);

    const payload: InvoiceCreatePayload = {
      invoice_number: invoiceNumber.trim(),
      company_name: company.companyName,
      company_email: company.companyEmail,
      payment_terms: company.paymentTerms,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      issue_date: issueDate,
      due_date: dueDate,
      tax_rate: company.taxRate,
      notes: notes,
      status: status,
      items: items.map((it) => ({
        description: it.description || 'Service',
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
      })),
    };

    try {
      const res = await saveInvoice(payload);
      setNotification({ type: 'success', message: res.message });
      onInvoiceSaved();

      if (andDownloadPdf && res.id) {
        await downloadInvoicePdf(res.id, payload.invoice_number);
      }

      // Auto generate next invoice number
      const match = invoiceNumber.match(/(\d+)$/);
      if (match) {
        const nextNum = String(parseInt(match[1]) + 1).padStart(match[1].length, '0');
        setInvoiceNumber(invoiceNumber.replace(/\d+$/, nextNum));
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save invoice.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-3 brutal-border brutal-shadow-sm flex items-center justify-between text-sm font-bold ${
            notification.type === 'success' ? 'bg-[#E3F2E1] text-[#1E3F30]' : 'bg-[#FFE2DE] text-[#931D1D]'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs uppercase font-extrabold px-2 py-0.5 brutal-border bg-white"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* 1. Quick Company Details Bar (Saved in LocalStorage) */}
      <div className="bg-[#FFFDF9] brutal-border brutal-shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xs uppercase tracking-wider bg-[#1E3F30] text-white px-2 py-0.5 brutal-border-sm">
              YOUR BUSINESS PROFILE
            </span>
            <span className="text-xs text-gray-600 font-medium">(Auto-saved to your browser)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Company / Vendor Name</label>
            <input
              type="text"
              className="brutal-input w-full"
              value={company.companyName}
              onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
              placeholder="e.g. Acme Design Studio"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Your Email</label>
            <input
              type="email"
              className="brutal-input w-full"
              value={company.companyEmail}
              onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })}
              placeholder="e.g. hello@acmestudio.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Currency</label>
            <select
              className="brutal-input w-full font-bold"
              value={company.currency || '₹'}
              onChange={(e) => setCompany({ ...company, currency: e.target.value })}
            >
              <option value="₹">₹ (INR - Rupee)</option>
              <option value="$">$ (USD - Dollar)</option>
              <option value="€">€ (EUR - Euro)</option>
              <option value="£">£ (GBP - Pound)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Tax Rate (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="brutal-input w-full"
              value={company.taxRate}
              onChange={(e) => setCompany({ ...company, taxRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Payment Terms</label>
            <input
              type="text"
              className="brutal-input w-full"
              value={company.paymentTerms}
              onChange={(e) => setCompany({ ...company, paymentTerms: e.target.value })}
              placeholder="e.g. Net 30, Due on Receipt"
            />
          </div>
        </div>
      </div>

      {/* 2. Invoice & Client Details */}
      <div className="bg-white brutal-border brutal-shadow p-5">
        <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold uppercase tracking-tight">Invoice Details & Recipient</h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="brutal-border text-xs font-bold py-1 px-2 bg-[#F4F0E8] outline-none"
            >
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Invoice Number *</label>
            <input
              type="text"
              className="brutal-input w-full font-mono font-bold"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Customer / Client Name *</label>
            <input
              type="text"
              className="brutal-input w-full"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Client / Company Name"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Customer Email</label>
            <input
              type="email"
              className="brutal-input w-full"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="client@company.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Issue Date</label>
              <input
                type="date"
                className="brutal-input w-full text-xs"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Due Date</label>
              <input
                type="date"
                className="brutal-input w-full text-xs"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Line Items Table */}
      <div className="bg-white brutal-border brutal-shadow p-5">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-tight">Line Items ({items.length} Points)</h2>
            <p className="text-xs text-gray-500 font-medium">All itemized particulars and rate calculations</p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center space-x-1 px-3 py-1 bg-[#1E3F30] text-white text-xs font-bold uppercase brutal-border brutal-shadow-sm hover:translate-x-0.5 hover:translate-y-0.5"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EFECE6] border-b-2 border-black text-xs font-black uppercase">
                <th className="p-2 border-r-2 border-black text-center w-12">#</th>
                <th className="p-2 border-r-2 border-black w-2/5">Item / Particulars</th>
                <th className="p-2 border-r-2 border-black text-center w-20">Qty</th>
                <th className="p-2 border-r-2 border-black text-right w-32">Rate ({curr})</th>
                <th className="p-2 border-r-2 border-black text-right w-32">Total ({curr})</th>
                <th className="p-2 text-center w-14">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-black hover:bg-[#FAF9F5]">
                  <td className="p-2 border-r-2 border-black text-center font-mono font-bold text-xs bg-[#F7F5F0]">
                    #{idx + 1}
                  </td>
                  <td className="p-2 border-r-2 border-black">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        className="brutal-input w-full text-sm font-semibold"
                        placeholder="e.g. Flash Tank Push Button"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleAiSuggest(idx)}
                        disabled={aiLoadingIdx === idx}
                        title="AI generate/polish description via Ollama"
                        className="p-1.5 bg-[#FFF2DE] hover:bg-[#FFE5B8] brutal-border flex items-center justify-center shrink-0"
                      >
                        <Sparkles size={14} className={aiLoadingIdx === idx ? 'animate-spin text-amber-600' : 'text-amber-700'} />
                      </button>
                    </div>
                  </td>
                  <td className="p-2 border-r-2 border-black">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="brutal-input w-full text-center text-sm font-mono font-bold"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="p-2 border-r-2 border-black">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="brutal-input w-full text-right text-sm font-mono"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="p-2 border-r-2 border-black text-right font-mono font-black text-sm text-[#1E3F30]">
                    {curr}{(item.quantity * item.unit_price).toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                      className="p-1 text-red-600 hover:text-red-900 disabled:opacity-30 disabled:hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Notes & Totals Calculation Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t-2 border-black">
          <div>
            <label className="block text-xs font-bold uppercase mb-1">Notes / Payment Terms</label>
            <textarea
              rows={3}
              className="brutal-input w-full text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add payment instructions, bank details, or thank you note..."
            />
          </div>

          <div className="bg-[#F7F5F0] brutal-border p-4 space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>Subtotal ({items.length} points):</span>
              <span className="font-mono">{curr}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Tax ({company.taxRate}%):</span>
              <span className="font-mono">{curr}{taxAmount.toFixed(2)}</span>
            </div>
            <div className="border-t-2 border-black pt-2 flex justify-between items-center text-base font-black">
              <span>TOTAL DUE:</span>
              <span className="text-xl font-mono bg-[#1E3F30] text-white px-2.5 py-0.5 brutal-border-sm">
                {curr}{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Action Buttons (Matching Screenshot Button Aesthetic) */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleSaveInvoice(false)}
          disabled={loading}
          className="px-6 py-2.5 bg-white brutal-border brutal-shadow font-extrabold text-sm uppercase tracking-wider brutal-shadow-hover flex items-center space-x-2"
        >
          <span>💾 Save Invoice</span>
        </button>

        <button
          type="button"
          onClick={() => handleSaveInvoice(true)}
          disabled={loading}
          className="px-6 py-2.5 bg-[#FF8577] text-black brutal-border brutal-shadow font-extrabold text-sm uppercase tracking-wider brutal-shadow-hover flex items-center space-x-2"
        >
          <Download size={16} />
          <span>{loading ? 'Processing...' : 'Save & Download PDF'}</span>
        </button>
      </div>
    </div>
  );
};
