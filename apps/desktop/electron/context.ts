/**
 * Application Context for IPC Handlers.
 *
 * Provides shared resources (database, configuration) to all IPC handlers.
 *
 * @module electron/context
 */

import { type IpcHandlerContext } from './ipc/handlers';

// Mock Database Implementation for UI Demo
// In a real app, this would import @voiceinvoice/database
const databaseOperations = {
  createInvoice: async (data: unknown) => {
    console.log('Mock DB: createInvoice', data);
    return { id: 'mock-id', ...(data as object) };
  },
  getCustomers: async () => {
    return [
      { id: 'c1', companyName: 'Acme Corp', type: 'CUSTOMER' },
      { id: 'c2', companyName: 'Globex', type: 'SUPPLIER' },
    ];
  },
  getSettings: async () => {
    return { privacyMode: 'STRICT', n8nEnabled: false };
  },
  updateSettings: async (data: unknown) => {
    console.log('Mock DB: updateSettings', data);
    return data;
  },
};

export const context: IpcHandlerContext = {
  database: databaseOperations,
};

export interface DatabaseOperations {
  createInvoice: (data: unknown) => Promise<any>;
  getCustomers: () => Promise<any[]>;
  getSettings: () => Promise<any>;
  updateSettings: (data: unknown) => Promise<any>;
}

export { type IpcHandlerContext };
