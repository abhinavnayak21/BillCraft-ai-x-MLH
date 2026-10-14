export interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount?: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  company_name: string;
  company_email: string;
  customer_name: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  tax_rate: number;
  currency?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  status: string;
  created_at?: string;
  items: LineItem[];
}

export interface InvoiceCreatePayload {
  invoice_number: string;
  company_name: string;
  company_email: string;
  payment_terms: string;
  customer_name: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  currency?: string;
  notes?: string;
  status: string;
  items: LineItem[];
}

export interface CompanyInfo {
  companyName: string;
  companyEmail: string;
  taxRate: number;
  paymentTerms: string;
  currency?: string;
}

export interface OllamaStatus {
  online: boolean;
  models: string[];
  active_model: string;
}

export interface ExtractedData {
  invoice_number?: string;
  company_name?: string;
  company_email?: string;
  customer_name?: string;
  customer_email?: string;
  issue_date?: string;
  due_date?: string;
  payment_terms?: string;
  tax_rate?: number;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  notes?: string;
  status?: string;
  items: LineItem[];
}

export interface ExtractionResponse {
  success: boolean;
  ai_used: boolean;
  model?: string;
  message: string;
  data: ExtractedData;
  raw_text_snippet?: string;
  error?: string;
  saved?: boolean;
  saved_invoice_id?: number;
  saved_invoice_number?: string;
}

