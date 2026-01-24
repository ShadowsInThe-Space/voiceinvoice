/**
 * CustomerSelect component.
 *
 * A searchable dropdown for selecting customers with filtering
 * capabilities, styled as a modern Command/Combobox.
 *
 * @module components/CustomerSelect
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Customer } from '@voiceinvoice/shared-types';
import { cn } from '../lib/utils';
import { Check, ChevronsUpDown, Search, User } from 'lucide-react';

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
 * @param {string} type - The customer type enum value
 * @returns {string} The localized label
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
 * @param {CustomerSelectProps} root0 - The component props
 * @param {string} [root0.value] - The selected customer ID
 * @param {Function} root0.onChange - Callback function when selection changes
 * @param {Array} root0.customers - Array of customer objects to select from
 * @returns {JSX.Element} The rendered component
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

  const handleSelect = useCallback(
    (customerId: string): void => {
      onChange(customerId);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onChange]
  );

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

  const handleToggle = useCallback((): void => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  if (customers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 border border-dashed rounded-md bg-muted/50">
        <User className="h-4 w-4" />
        <span>Keine Kunden verfügbar</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Trigger */}
      <button
        type="button"
        role="combobox"
        aria-label="Kunde auswählen"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-xl border-2 border-transparent bg-muted/20 px-4 py-2 text-sm shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary",
          !selectedCustomer && "text-muted-foreground",
          isOpen && "border-primary bg-background shadow-lg"
        )}
      >
        <span className="truncate font-medium">
          {selectedCustomer?.companyName || 'Kunde auswählen...'}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-[400px] w-full min-w-[320px] overflow-hidden rounded-xl border border-border/50 bg-card text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Search Input */}
          <div className="flex items-center border-b border-border/50 px-4 bg-muted/10">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Kunden suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results List */}
          <ul
            role="listbox"
            className="max-h-[280px] overflow-y-auto p-2 space-y-1"
            aria-label="Kundenliste"
          >
            {filteredCustomers.length === 0 ? (
              <li className="relative flex cursor-default select-none items-center rounded-lg px-2 py-8 text-sm outline-none text-muted-foreground justify-center italic">
                Keine Kunden gefunden.
              </li>
            ) : (
              filteredCustomers.map((customer, index) => (
                <li
                  key={customer.id}
                  role="option"
                  aria-selected={customer.id === value}
                  onClick={() => handleSelect(customer.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-all",
                    index === highlightedIndex 
                      ? "bg-primary/10 text-primary" 
                      : "text-foreground hover:bg-muted/50",
                    customer.id === value && "bg-primary text-white font-bold"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      customer.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-1 items-center justify-between gap-4 overflow-hidden">
                    <div className="flex flex-col truncate">
                      <span className="truncate">{customer.companyName}</span>
                      {customer.contactPerson && (
                        <span className={cn(
                          "text-[10px] uppercase font-black tracking-widest",
                          customer.id === value ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {customer.contactPerson}
                        </span>
                      )}
                    </div>
                    <span
                      data-testid={`customer-type-${customer.id}`}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border shrink-0",
                        customer.id === value 
                          ? "border-white/20 bg-white/20 text-white"
                          : customer.type === 'SUPPLIER'
                            ? "border-secondary/20 bg-secondary/10 text-secondary"
                            : "border-primary/20 bg-primary/5 text-primary"
                      )}
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

