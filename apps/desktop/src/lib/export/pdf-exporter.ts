/**
 * PDF Exporter for VoiceInvoice Enterprise.
 *
 * Generates professional German-formatted invoice PDFs using jsPDF.
 * Supports both German and English language options.
 *
 * @module lib/export/pdf-exporter
 */

import { jsPDF } from 'jspdf';

/**
 * Invoice item structure.
 */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
}

/**
 * Invoice structure with items.
 */
export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  voiceRecordingId: string | null;
  transcription: string | null;
  notes: string | null;
  paymentTerms: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncVersion: number;
  items: InvoiceItem[];
}

/**
 * Customer structure.
 */
export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  syncVersion: number;
}

/**
 * Company information for invoice header.
 */
export interface CompanyInfo {
  name: string;
  address: string;
  taxId?: string;
  bankInfo?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoBase64?: string;
}

/**
 * Options for PDF export.
 */
export interface PDFExportOptions {
  invoice: Invoice;
  customer: Customer;
  companyInfo?: CompanyInfo;
  language?: 'de' | 'en';
}

/**
 * Labels for invoice elements in different languages.
 */
export interface InvoiceLabels {
  invoice: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  tax: string;
  totalDue: string;
  paymentTerms: string;
  bankDetails: string;
  taxId: string;
  page: string;
  of: string;
}

/**
 * German labels.
 */
const GERMAN_LABELS: InvoiceLabels = {
  invoice: 'Rechnung',
  invoiceNumber: 'Rechnungsnummer',
  invoiceDate: 'Rechnungsdatum',
  dueDate: 'Fälligkeitsdatum',
  customerNumber: 'Kundennummer',
  description: 'Beschreibung',
  quantity: 'Menge',
  unitPrice: 'Einzelpreis',
  total: 'Gesamt',
  subtotal: 'Netto',
  tax: 'MwSt.',
  totalDue: 'Brutto',
  paymentTerms: 'Zahlungsbedingungen',
  bankDetails: 'Bankverbindung',
  taxId: 'USt-IdNr.',
  page: 'Seite',
  of: 'von',
};

/**
 * English labels.
 */
const ENGLISH_LABELS: InvoiceLabels = {
  invoice: 'Invoice',
  invoiceNumber: 'Invoice Number',
  invoiceDate: 'Invoice Date',
  dueDate: 'Due Date',
  customerNumber: 'Customer Number',
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  total: 'Total',
  subtotal: 'Subtotal',
  tax: 'VAT',
  totalDue: 'Total Due',
  paymentTerms: 'Payment Terms',
  bankDetails: 'Bank Details',
  taxId: 'Tax ID',
  page: 'Page',
  of: 'of',
};

/**
 * PDF layout constants.
 */
const LAYOUT = {
  pageWidth: 210,
  pageHeight: 297,
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 20,
  contentWidth: 170, // pageWidth - marginLeft - marginRight

  // Header area
  logoAreaTop: 20,
  logoAreaHeight: 30,

  // Address window (DIN 5008)
  addressWindowTop: 55,
  addressWindowLeft: 20,
  addressWindowWidth: 85,
  addressWindowHeight: 45,

  // Invoice info (right side)
  infoBlockTop: 55,
  infoBlockLeft: 120,

  // Items table
  tableTop: 115,
  tableHeaderHeight: 8,
  tableRowHeight: 7,

  // Column widths
  colDescription: 80,
  colQuantity: 20,
  colUnitPrice: 30,
  colTotal: 30,

  // Footer
  footerTop: 260,
};

/**
 * PDF Exporter class for generating invoice PDFs.
 */
export class PDFExporter {
  /**
   * Generates an invoice PDF from the provided options.
   */
  async generateInvoicePDF(options: PDFExportOptions): Promise<Blob> {
    // Validate input
    if (!options.invoice) {
      throw new Error('Invoice is required');
    }
    if (!options.customer) {
      throw new Error('Customer is required');
    }

    const language = options.language ?? 'de';
    const labels = this.getLabels(language);

    // Create PDF document (A4 format)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Render invoice sections
    this.renderHeader(doc, options.companyInfo, labels);
    this.renderAddressWindow(doc, options.customer, options.companyInfo);
    this.renderInvoiceInfo(doc, options.invoice, labels, language);
    this.renderItemsTable(doc, options.invoice, labels, language);
    this.renderTotals(doc, options.invoice, labels, language);
    this.renderPaymentTerms(doc, options.invoice, labels);
    this.renderFooter(doc, options.companyInfo, labels);

    // Generate blob
    const arrayBuffer = doc.output('arraybuffer');
    return new Blob([arrayBuffer], { type: 'application/pdf' });
  }

  /**
   * Saves a PDF blob to a file.
   */
  async saveToFile(blob: Blob, filename: string): Promise<string> {
    // Ensure .pdf extension
    const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    // In Electron environment, use the electronAPI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const arrayBuffer = await blob.arrayBuffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).electronAPI.writeFile(finalFilename, arrayBuffer);
      return finalFilename;
    }

    // Fallback for browser environment
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return finalFilename;
  }

  /**
   * Gets labels for the specified language.
   */
  getLabels(language: 'de' | 'en'): InvoiceLabels {
    return language === 'de' ? GERMAN_LABELS : ENGLISH_LABELS;
  }

  /**
   * Formats a currency amount.
   */
  formatCurrency(amount: number, currency: string, language: 'de' | 'en'): string {
    if (language === 'de') {
      // German format: 1.234,56 EUR
      const formatted = amount.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ${currency}`;
    } else {
      // English format: 1,234.56 EUR
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ${currency}`;
    }
  }

  /**
   * Formats a date.
   */
  formatDate(date: Date | null, language: 'de' | 'en'): string {
    if (!date) return '-';

    if (language === 'de') {
      // German format: DD.MM.YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } else {
      // English format: MM/DD/YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  }

  /**
   * Renders the header with company logo.
   */
  private renderHeader(doc: jsPDF, companyInfo?: CompanyInfo, _labels?: InvoiceLabels): void {
    const { marginLeft, logoAreaTop, logoAreaHeight, contentWidth } = LAYOUT;

    if (companyInfo?.logoBase64) {
      // Render actual logo if available
      try {
        // Keep aspect ratio
        const logoWidth = 50;
        const logoHeight = logoAreaHeight;

        let format = 'PNG';
        if (companyInfo.logoBase64.startsWith('data:image/jpeg') || companyInfo.logoBase64.startsWith('data:image/jpg')) {
          format = 'JPEG';
        }

        doc.addImage(companyInfo.logoBase64, format, marginLeft, logoAreaTop, logoWidth, logoHeight, undefined, 'FAST');
      } catch (e) {
        console.warn('Failed to render logo:', e);
        // Fallback to placeholder on error
        this.renderLogoPlaceholder(doc, marginLeft, logoAreaTop, logoAreaHeight);
      }
    } else {
      // Render placeholder
      this.renderLogoPlaceholder(doc, marginLeft, logoAreaTop, logoAreaHeight);
    }

    // Company info on the right
    if (companyInfo) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name, marginLeft + contentWidth, logoAreaTop, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      let y = logoAreaTop + 5;
      const addressLines = companyInfo.address.split('\n');
      for (const line of addressLines) {
        doc.text(line, marginLeft + contentWidth, y, { align: 'right' });
        y += 4;
      }

      if (companyInfo.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, marginLeft + contentWidth, y, { align: 'right' });
        y += 4;
      }
      if (companyInfo.email) {
        doc.text(companyInfo.email, marginLeft + contentWidth, y, { align: 'right' });
        y += 4;
      }
      if (companyInfo.website) {
        doc.text(companyInfo.website, marginLeft + contentWidth, y, { align: 'right' });
      }
    }
  }

  /**
   * Renders logo placeholder.
   */
  private renderLogoPlaceholder(doc: jsPDF, x: number, y: number, h: number): void {
    // Logo placeholder area (dashed rectangle)
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, 50, h);
    doc.setLineDashPattern([], 0);

    // Placeholder text
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Logo', x + 25, y + h / 2, { align: 'center' });
  }

  /**
   * Renders the address window (DIN 5008 compliant).
   */
  private renderAddressWindow(doc: jsPDF, customer: Customer, companyInfo?: CompanyInfo): void {
    const { addressWindowTop, addressWindowLeft } = LAYOUT;

    // Return address line (small text above customer address)
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    if (companyInfo) {
      const returnAddress = `${companyInfo.name} - ${companyInfo.address.split('\n').join(' - ')}`;
      doc.text(returnAddress, addressWindowLeft, addressWindowTop);
    }

    // Customer address
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    let y = addressWindowTop + 8;

    // Customer name
    doc.setFont('helvetica', 'bold');
    doc.text(customer.name, addressWindowLeft, y);
    y += 5;

    doc.setFont('helvetica', 'normal');

    // Address
    if (customer.address) {
      doc.text(customer.address, addressWindowLeft, y);
      y += 5;
    }

    // City and zip code
    if (customer.zipCode || customer.city) {
      const cityLine = [customer.zipCode, customer.city].filter(Boolean).join(' ');
      doc.text(cityLine, addressWindowLeft, y);
      y += 5;
    }

    // Country (only if not DE)
    if (customer.country && customer.country !== 'DE') {
      doc.text(customer.country, addressWindowLeft, y);
    }
  }

  /**
   * Renders invoice information block (right side).
   */
  private renderInvoiceInfo(
    doc: jsPDF,
    invoice: Invoice,
    labels: InvoiceLabels,
    language: 'de' | 'en'
  ): void {
    const { infoBlockTop, infoBlockLeft, contentWidth, marginLeft } = LAYOUT;

    // Invoice title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(labels.invoice, infoBlockLeft, infoBlockTop);

    // Invoice details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const labelX = infoBlockLeft;
    const valueX = marginLeft + contentWidth;

    let y = infoBlockTop + 10;
    const lineHeight = 5;

    // Invoice number
    doc.text(`${labels.invoiceNumber}:`, labelX, y);
    doc.text(invoice.number, valueX, y, { align: 'right' });
    y += lineHeight;

    // Invoice date
    doc.text(`${labels.invoiceDate}:`, labelX, y);
    doc.text(this.formatDate(invoice.issuedAt || invoice.createdAt, language), valueX, y, {
      align: 'right',
    });
    y += lineHeight;

    // Due date
    if (invoice.dueAt) {
      doc.text(`${labels.dueDate}:`, labelX, y);
      doc.text(this.formatDate(invoice.dueAt, language), valueX, y, { align: 'right' });
      y += lineHeight;
    }

    // Customer number
    doc.text(`${labels.customerNumber}:`, labelX, y);
    doc.text(invoice.customerId.substring(0, 10).toUpperCase(), valueX, y, { align: 'right' });
  }

  /**
   * Renders the items table.
   */
  private renderItemsTable(
    doc: jsPDF,
    invoice: Invoice,
    labels: InvoiceLabels,
    language: 'de' | 'en'
  ): void {
    const { tableTop, marginLeft, colDescription, colQuantity, colUnitPrice, colTotal } = LAYOUT;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, tableTop, 170, 8, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    let x = marginLeft + 2;
    const headerY = tableTop + 5.5;

    doc.text(labels.description, x, headerY);
    x += colDescription;

    doc.text(labels.quantity, x + colQuantity / 2, headerY, { align: 'center' });
    x += colQuantity;

    doc.text(labels.unitPrice, x + colUnitPrice - 2, headerY, { align: 'right' });
    x += colUnitPrice;

    doc.text(labels.total, x + colTotal - 2, headerY, { align: 'right' });

    // Table rows
    doc.setFont('helvetica', 'normal');
    let y = tableTop + 14;

    for (const item of invoice.items) {
      x = marginLeft + 2;

      // Description (with text wrapping for long descriptions)
      const descriptionLines = doc.splitTextToSize(item.description, colDescription - 4);
      doc.text(descriptionLines, x, y);
      x += colDescription;

      // Quantity
      doc.text(item.quantity.toString(), x + colQuantity / 2, y, { align: 'center' });
      x += colQuantity;

      // Unit price
      doc.text(this.formatCurrency(item.unitPrice, invoice.currency, language), x + colUnitPrice - 2, y, {
        align: 'right',
      });
      x += colUnitPrice;

      // Total
      doc.text(this.formatCurrency(item.total, invoice.currency, language), x + colTotal - 2, y, {
        align: 'right',
      });

      // Move to next row (account for multi-line descriptions)
      y += Math.max(descriptionLines.length * 4, 7);
    }

    // Draw line under table
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, y, marginLeft + 170, y);
  }

  /**
   * Renders the totals section.
   */
  private renderTotals(
    doc: jsPDF,
    invoice: Invoice,
    labels: InvoiceLabels,
    language: 'de' | 'en'
  ): void {
    const { marginLeft, contentWidth } = LAYOUT;

    // Calculate position based on items
    let y = LAYOUT.tableTop + 14 + invoice.items.length * 7 + 10;

    const labelX = marginLeft + contentWidth - 60;
    const valueX = marginLeft + contentWidth;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Subtotal (Netto)
    doc.text(`${labels.subtotal}:`, labelX, y);
    doc.text(this.formatCurrency(invoice.subtotal, invoice.currency, language), valueX, y, {
      align: 'right',
    });
    y += 6;

    // Tax (MwSt.)
    const taxLabel = `${labels.tax} (${invoice.taxRate}%):`;
    doc.text(taxLabel, labelX, y);
    doc.text(this.formatCurrency(invoice.taxAmount, invoice.currency, language), valueX, y, {
      align: 'right',
    });
    y += 6;

    // Line before total
    doc.setDrawColor(0, 0, 0);
    doc.line(labelX, y - 2, valueX, y - 2);

    // Total (Brutto)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${labels.totalDue}:`, labelX, y + 3);
    doc.text(this.formatCurrency(invoice.total, invoice.currency, language), valueX, y + 3, {
      align: 'right',
    });
  }

  /**
   * Renders payment terms and notes.
   */
  private renderPaymentTerms(doc: jsPDF, invoice: Invoice, labels: InvoiceLabels): void {
    const { marginLeft } = LAYOUT;

    // Calculate position based on items
    let y = LAYOUT.tableTop + 14 + invoice.items.length * 7 + 40;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Payment terms
    if (invoice.paymentTerms) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${labels.paymentTerms}:`, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      y += 5;
      doc.text(invoice.paymentTerms, marginLeft, y);
      y += 10;
    }

    // Notes
    if (invoice.notes) {
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, marginLeft, y);
    }
  }

  /**
   * Renders the footer with bank details.
   */
  private renderFooter(doc: jsPDF, companyInfo?: CompanyInfo, labels?: InvoiceLabels): void {
    const { marginLeft, footerTop, contentWidth } = LAYOUT;

    // Footer line
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, footerTop - 5, marginLeft + contentWidth, footerTop - 5);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    if (companyInfo) {
      let y = footerTop;

      // Bank details
      if (companyInfo.bankInfo && labels) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${labels.bankDetails}:`, marginLeft, y);
        doc.setFont('helvetica', 'normal');

        const bankLines = companyInfo.bankInfo.split('\n');
        const x = marginLeft + 30;
        for (const line of bankLines) {
          doc.text(line, x, y);
          y += 4;
        }

        y = footerTop;
      }

      // Tax ID on the right
      if (companyInfo.taxId && labels) {
        doc.text(`${labels.taxId}: ${companyInfo.taxId}`, marginLeft + contentWidth, footerTop, {
          align: 'right',
        });
      }
    }
  }
}
