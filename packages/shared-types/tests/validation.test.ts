import { describe, it, expect } from 'vitest';
import {
  validateInvoiceData,
  validateCustomerData,
  ValidationError,
  type InvoiceData,
  type CustomerData,
} from '../src/validation';

describe('validateInvoiceData', () => {
  describe('valid invoices', () => {
    it('should accept a valid invoice with all required fields', () => {
      const invoice: InvoiceData = {
        customerName: 'Acme Corporation GmbH',
        amount: 1000.0,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(invoice);
    });

    it('should accept invoice with optional description', () => {
      const invoice: InvoiceData = {
        customerName: 'Test Company',
        amount: 500.5,
        taxRate: 7,
        description: 'Consulting services for Q1',
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Consulting services for Q1');
    });

    it('should accept invoice with 0% tax rate', () => {
      const invoice: InvoiceData = {
        customerName: 'Export Customer',
        amount: 2000,
        taxRate: 0,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
    });
  });

  describe('invalid invoices', () => {
    it('should reject invoice with empty customer name', () => {
      const invoice = {
        customerName: '',
        amount: 100,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('customerName');
    });

    it('should reject invoice with negative amount', () => {
      const invoice = {
        customerName: 'Test Customer',
        amount: -100,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('amount');
    });

    it('should reject invoice with zero amount', () => {
      const invoice = {
        customerName: 'Test Customer',
        amount: 0,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('amount');
    });

    it('should reject invoice with invalid tax rate', () => {
      const invoice = {
        customerName: 'Test Customer',
        amount: 100,
        taxRate: 25,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('taxRate');
    });

    it('should reject invoice with missing required fields', () => {
      const invoice = {
        customerName: 'Test',
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
    });

    it('should reject invoice with wrong types', () => {
      const invoice = {
        customerName: 123,
        amount: 'not a number',
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept very small amounts', () => {
      const invoice: InvoiceData = {
        customerName: 'Small Order',
        amount: 0.01,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
    });

    it('should accept very large amounts', () => {
      const invoice: InvoiceData = {
        customerName: 'Enterprise Customer',
        amount: 9999999.99,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
    });

    it('should trim customer name whitespace', () => {
      const invoice = {
        customerName: '  Acme Corp  ',
        amount: 100,
        taxRate: 19,
      };

      const result = validateInvoiceData(invoice);

      expect(result.success).toBe(true);
      expect(result.data?.customerName).toBe('Acme Corp');
    });
  });
});

describe('validateCustomerData', () => {
  describe('valid customers', () => {
    it('should accept a valid customer with required fields', () => {
      const customer: CustomerData = {
        companyName: 'Mustermann GmbH',
        type: 'CUSTOMER',
      };

      const result = validateCustomerData(customer);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(customer);
    });

    it('should accept customer with all optional fields', () => {
      const customer: CustomerData = {
        companyName: 'Complete Company',
        type: 'BOTH',
        contactPerson: 'Max Mustermann',
        email: 'max@example.com',
        phone: '+49 123 456789',
        taxNumber: 'DE123456789',
        vatId: 'DE123456789',
        street: 'Musterstraße 1',
        zip: '12345',
        city: 'Berlin',
        country: 'DE',
      };

      const result = validateCustomerData(customer);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(customer);
    });
  });

  describe('invalid customers', () => {
    it('should reject customer with empty company name', () => {
      const customer = {
        companyName: '',
        type: 'CUSTOMER',
      };

      const result = validateCustomerData(customer);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('companyName');
    });

    it('should reject customer with invalid type', () => {
      const customer = {
        companyName: 'Test Company',
        type: 'INVALID',
      };

      const result = validateCustomerData(customer);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('type');
    });

    it('should reject customer with invalid email format', () => {
      const customer = {
        companyName: 'Test Company',
        type: 'CUSTOMER',
        email: 'not-an-email',
      };

      const result = validateCustomerData(customer);

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('email');
    });
  });
});

describe('ValidationError', () => {
  it('should create error with message and field', () => {
    const error = new ValidationError('Invalid amount', 'amount');

    expect(error.message).toBe('Invalid amount');
    expect(error.field).toBe('amount');
    expect(error.name).toBe('ValidationError');
  });

  it('should be instanceof Error', () => {
    const error = new ValidationError('Test error', 'test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });
});
