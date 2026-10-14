import React, { useState, useEffect } from 'react';
import { Download, Trash2, Cpu, RefreshCw } from 'lucide-react';
import { GenerateTab } from './GenerateTab';
import { ReaderTab } from './ReaderTab';
import type { Invoice, ExtractedData, OllamaStatus } from './types';
import { fetchInvoices, removeInvoice, downloadInvoicePdf, fetchOllamaStatus } from './api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'reader'>('generate');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(true);
  const [ollamaInfo, setOllamaInfo] = useState<OllamaStatus>({ online: false, models: [], active_model: 'qwen' });
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Data transferred from Reader tab into Generator tab
  const [prefilledData, setPrefilledData] = useState<ExtractedData | null>(null);

  const loadData = async () => {
    setLoadingInvoices(true);
    try {
      const [invList, oStatus] = await Promise.all([
        fetchInvoices(),
        fetchOllamaStatus()
      ]);
      setInvoices(invList);
      setOllamaInfo(oStatus);
    } catch (err) {
      console.error('Failed to load initial data', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteInvoice = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await removeInvoice(id);
      setInvoices(invoices.filter((inv) => inv.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete invoice');
    }
  };

  const handleImportToGenerator = (extracted: ExtractedData) => {
    setPrefilledData(extracted);
    setActiveTab('generate');
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus === 'ALL') return true;
    return inv.status.toUpperCase() === filterStatus;
  });

  // Calculate quick summary metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const currentDateLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F0E8] flex flex-col font-sans text-[#111111]">
      {/* 1. TOP HEADER (Deep Pine Green matching reference) */}
      <header className="bg-[#1E3F30] text-white border-b-2 border-black px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-6">
            <h1 className="logo-font text-2xl tracking-tighter uppercase font-black cursor-pointer text-[#F4F0E8]" onClick={() => setActiveTab('generate')}>
              BILLCRAFT
            </h1>
            
            <nav className="hidden md:flex items-center space-x-5 text-xs font-bold uppercase tracking-wider text-[#D8E2DC]">
              <button
                onClick={() => { setActiveTab('generate'); setPrefilledData(null); }}
                className={`hover:text-white transition-colors pb-0.5 ${activeTab === 'generate' ? 'text-white border-b-2 border-white' : ''}`}
              >
                Generate Invoice
              </button>
              <button
                onClick={() => setActiveTab('reader')}
                className={`hover:text-white transition-colors pb-0.5 ${activeTab === 'reader' ? 'text-white border-b-2 border-white' : ''}`}
              >
                Scan Invoice (OCR)
              </button>
              <a href="#saved-invoices" className="hover:text-white transition-colors">
                Saved Invoices ({invoices.length})
              </a>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {/* Ollama Status Badge */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold uppercase bg-[#142A20] brutal-border-sm text-[#F4F0E8]">
              <Cpu size={13} className={ollamaInfo.online ? 'text-emerald-400' : 'text-gray-400'} />
              <span>Ollama: {ollamaInfo.online ? ollamaInfo.active_model : 'Offline (Fallback Mode)'}</span>
            </div>

            {/* Accent Action CTA Button (Matching Salmon CTA in reference) */}
            <button
              onClick={() => {
                setActiveTab('generate');
                setPrefilledData(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-1.5 bg-[#FF8577] text-black text-xs font-black uppercase tracking-wider brutal-border brutal-shadow-sm brutal-shadow-hover"
            >
              + New Invoice
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUBHEADER / STATUS BAR (Directly matching reference metadata bar) */}
      <section className="bg-[#EFECE6] border-b-2 border-black px-4 sm:px-8 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono font-black tracking-wider uppercase">
              {currentDateLabel} • {invoices.length} INVOICES
            </span>
            <span className="text-gray-400 font-bold">|</span>
            
            {/* Filter Pills matching the reference image badge pills */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-0.5 font-black text-[10px] uppercase brutal-border-sm ${
                  filterStatus === 'ALL' ? 'bg-[#1E3F30] text-white' : 'bg-white text-black'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterStatus('PAID')}
                className={`px-2 py-0.5 font-black text-[10px] uppercase brutal-border-sm ${
                  filterStatus === 'PAID' ? 'bg-[#FF8577] text-black' : 'bg-[#FFD6CF] text-black'
                }`}
              >
                PAID
              </button>
              <button
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2 py-0.5 font-black text-[10px] uppercase brutal-border-sm ${
                  filterStatus === 'PENDING' ? 'bg-[#7BB4E3] text-black' : 'bg-[#D2E6FF] text-black'
                }`}
              >
                PENDING
              </button>
              <button
                onClick={() => setFilterStatus('DRAFT')}
                className={`px-2 py-0.5 font-black text-[10px] uppercase brutal-border-sm border-dashed ${
                  filterStatus === 'DRAFT' ? 'bg-gray-300 text-black' : 'bg-transparent text-gray-700'
                }`}
              >
                DRAFT
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4 font-mono font-bold">
            <div>
              <span className="text-gray-600 mr-1">TOTAL VAL:</span>
              <span className="bg-white px-2 py-0.5 brutal-border-sm">${totalRevenue.toFixed(2)}</span>
            </div>
            <button
              onClick={loadData}
              title="Refresh list"
              className="p-1 bg-white hover:bg-[#FAF8F5] brutal-border-sm"
            >
              <RefreshCw size={13} className={loadingInvoices ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {/* 3. MAIN WORKSPACE */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-6 space-y-8">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-2 border-b-2 border-black pb-2">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 font-black text-xs uppercase tracking-wider brutal-border ${
              activeTab === 'generate'
                ? 'bg-[#1E3F30] text-white brutal-shadow-sm'
                : 'bg-white text-black hover:bg-[#FAF8F5]'
            }`}
          >
            🧾 Invoice Generator
          </button>
          <button
            onClick={() => setActiveTab('reader')}
            className={`px-4 py-2 font-black text-xs uppercase tracking-wider brutal-border ${
              activeTab === 'reader'
                ? 'bg-[#1E3F30] text-white brutal-shadow-sm'
                : 'bg-white text-black hover:bg-[#FAF8F5]'
            }`}
          >
            📂 Scan & Extract (OCR + Ollama)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'generate' ? (
          <GenerateTab initialData={prefilledData} onInvoiceSaved={loadData} />
        ) : (
          <ReaderTab onImportToGenerator={handleImportToGenerator} onInvoiceSaved={loadData} />
        )}

        {/* 4. SAVED INVOICES LIST (Matching the reference cards design) */}
        <section id="saved-invoices" className="pt-6 border-t-2 border-black space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Recent Invoices</h2>
              <p className="text-xs text-gray-600 font-medium">
                Showing {filteredInvoices.length} saved records
              </p>
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="bg-white brutal-border brutal-shadow p-8 text-center text-gray-500 font-bold text-sm">
              No invoices found matching current filter. Create a new invoice or scan one above!
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((inv) => {
                // Parse date for reference-style badge
                let day = '14';
                let month = 'OCT';
                if (inv.issue_date) {
                  const parts = inv.issue_date.split('-');
                  if (parts.length === 3) {
                    day = parts[2];
                    const monthIdx = parseInt(parts[1], 10) - 1;
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    month = months[monthIdx] || 'OCT';
                  }
                }

                return (
                  <div
                    key={inv.id}
                    className="bg-white brutal-border brutal-shadow p-3.5 flex flex-wrap items-center justify-between gap-4 brutal-shadow-hover transition-transform"
                  >
                    {/* Left Date / Number Badge Box (Direct visual match to reference) */}
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-[#F4F0E8] brutal-border flex flex-col items-center justify-center text-center shrink-0">
                        <span className="font-mono text-sm font-black leading-none">{day}</span>
                        <span className="text-[9px] font-black uppercase text-gray-700">{month}</span>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-sm tracking-tight">
                            {inv.invoice_number}: {inv.customer_name || 'Valued Client'}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-gray-600">
                          <span className="font-mono">{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{inv.payment_terms || 'Net 30'}</span>
                          {inv.due_date && (
                            <>
                              <span>•</span>
                              <span>Due: {inv.due_date}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Metadata & Action Buttons */}
                    <div className="flex items-center space-x-3 ml-auto">
                      {/* Status Pill Badge */}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase brutal-border-sm ${
                          inv.status === 'PAID'
                            ? 'bg-[#FFD6CF] text-black'
                            : inv.status === 'PENDING'
                            ? 'bg-[#D2E6FF] text-black'
                            : 'bg-gray-200 text-gray-700 border-dashed'
                        }`}
                      >
                        {inv.status}
                      </span>

                      {/* Total Amount */}
                      <span className="font-mono font-black text-base min-w-[85px] text-right">
                        ${inv.total.toFixed(2)}
                      </span>

                      {/* PDF Action */}
                      <button
                        onClick={() => downloadInvoicePdf(inv.id, inv.invoice_number)}
                        title="Download Branded PDF"
                        className="px-2.5 py-1 bg-[#1E3F30] text-white text-xs font-bold uppercase brutal-border-sm hover:bg-[#142A20] flex items-center space-x-1"
                      >
                        <Download size={13} />
                        <span>PDF</span>
                      </button>

                      {/* Delete Action */}
                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        title="Delete Invoice"
                        className="p-1 bg-[#FFE2DE] hover:bg-[#FFD0CA] text-red-900 brutal-border-sm"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="mt-12 border-t-2 border-black bg-[#EFECE6] py-4 text-center text-xs font-bold text-gray-600">
        <p>BILLCRAFT AI • LOCAL OLLAMA POWERED • BUILT FOR FREELANCERS & SMALL BUSINESSES</p>
      </footer>
    </div>
  );
};

export default App;
