import type { Invoice, InvoiceCreatePayload, OllamaStatus, ExtractionResponse } from './types';

const API_BASE = '/api';

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${API_BASE}/ollama/status`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Ollama status check failed', err);
  }
  return { online: false, models: [], active_model: 'qwen2.5:latest' };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch(`${API_BASE}/invoices`);
  if (!res.ok) {
    throw new Error('Failed to load invoices');
  }
  return await res.json();
}

export async function saveInvoice(payload: InvoiceCreatePayload): Promise<{ success: boolean; id: number; message: string }> {
  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to save invoice');
  }
  return data;
}

export async function removeInvoice(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to delete invoice');
  }
}

export async function downloadInvoicePdf(id: number, invoiceNumber: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${id}/pdf`);
  if (!res.ok) {
    throw new Error('Failed to download PDF');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${invoiceNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function uploadAndExtractInvoice(file: File, autoSave: boolean = true): Promise<ExtractionResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/reader/extract?auto_save=${autoSave}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to extract invoice data');
  }

  return await res.json();
}

export async function describeLineItem(title: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/ai/describe-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.description || '';
    }
  } catch (err) {
    console.warn('AI description failed', err);
  }
  return `Professional ${title} deliverable package.`;
}
