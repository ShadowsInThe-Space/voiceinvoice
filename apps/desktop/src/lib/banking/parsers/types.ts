export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  description: string;
  senderName?: string;
  senderIban?: string;
  reference?: string;
  // Account info if available in the file (e.g. MT940 :25:)
  accountIban?: string;
}

export interface BankStatementParser {
  parse(content: string): Promise<ParsedTransaction[]>;
}
