/**
 * CustomerSelect component.
 *
 * A searchable dropdown for selecting customers with filtering
 * capabilities.
 *
 * @module components/CustomerSelect
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Customer } from '@voiceinvoice/shared-types';

/**
 * Props for CustomerSelect component.
 */
export interface CustomerSelectProps {
  /** Currently selected customer ID */
  value?: string;
  /** Callback when selection changes */
  onChange: (customerId: string) => void;
  /** List of available customers */
  customers: Customer[];
}

/**
 * Gets display label for customer type.
 *
 * @param {string} type - Customer type
 * @returns {string} Localized type label
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'CUSTOMER':
      return 'Kunde';
    case 'SUPPLIER':
      return 'Lieferant';
    case 'BOTH':
      return 'Kunde/Lieferant';
    default:
      return type;
  }
}

/**
 * Searchable customer selection dropdown.
 *
 * Features:
 * - Search by company name or contact person
 * - Case-insensitive filtering
 * - Keyboard navigation support
 * - Customer type indicators
 *
 * @param {CustomerSelectProps} props - Component props
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * <CustomerSelect
 *   value={selectedCustomerId}
 *   onChange={(id) => setSelectedCustomerId(id)}
 *   customers={customerList}
 * />
 */
export function CustomerSelect({
  value,
  onChange,
  customers,
}: CustomerSelectProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected customer
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value]
  );

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) {
      return customers;
    }

    const term = searchTerm.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.companyName.toLowerCase().includes(term) ||
        (customer.contactPerson?.toLowerCase().includes(term) ?? false)
    );
  }, [customers, searchTerm]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCustomers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handles customer selection.
   */
  const handleSelect = useCallback(
    (customerId: string) => {
      onChange(customerId);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onChange]
  );

  /**
   * Handles keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (isOpen && filteredCustomers[highlightedIndex]) {
            handleSelect(filteredCustomers[highlightedIndex].id);
          } else {
            setIsOpen(true);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredCustomers.length - 1 ? prev + 1 : prev
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
      }
    },
    [isOpen, filteredCustomers, highlightedIndex, handleSelect]
  );

  /**
   * Handles combobox toggle.
   */
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      // Focus search input when opening
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Empty state when no customers
  if (customers.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-2 border rounded-md">
        Keine Kunden verfuegbar
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Combobox trigger */}
      <button
        type="button"
        role="combobox"
        aria-label="Kunde auswaehlen"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="
          w-full flex items-center justify-between
          px-3 py-2 text-left
          bg-white border border-gray-300 rounded-md shadow-sm
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
        "
      >
        <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-500'}>
          {selectedCustomer?.companyName || 'Kunde auswaehlen'}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="
                w-full px-3 py-2
                border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            />
          </div>

          {/* Customer list */}
          <ul
            role="listbox"
            className="max-h-60 overflow-auto py-1"
            aria-label="Kundenliste"
          >
            {filteredCustomers.length === 0 ? (
              <li className="px-3 py-2 text-gray-500 text-sm">
                Keine Kunden gefunden
              </li>
            ) : (
              filteredCustomers.map((customer, index) => (
                <li
                  key={customer.id}
                  role="option"
                  aria-selected={customer.id === value}
                  onClick={() => handleSelect(customer.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    px-3 py-2 cursor-pointer
                    ${index === highlightedIndex ? 'bg-blue-50' : ''}
                    ${customer.id === value ? 'bg-blue-100' : ''}
                    hover:bg-blue-50
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {customer.companyName}
                      </div>
                      {customer.contactPerson && (
                        <div className="text-sm text-gray-500">
                          {customer.contactPerson}
                        </div>
                      )}
                    </div>
                    <span
                      data-testid={`customer-type-${customer.id}`}
                      className={`
                        text-xs px-2 py-1 rounded-full
                        ${
                          customer.type === 'SUPPLIER'
                            ? 'bg-orange-100 text-orange-800'
                            : customer.type === 'BOTH'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }
                      `}
                    >
                      {getTypeLabel(customer.type)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
