import React, { useState, useEffect } from 'react';
import { Upload, Landmark, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Transaction {
    id: string;
    date: string;
    amount: number;
    description: string;
    senderName?: string;
    status: string;
    bankAccount?: {
        iban: string;
    }
}

export default function BankingPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number, skipped: number } | null>(null);

    useEffect(() => {
        loadTransactions();
    }, []);

    const loadTransactions = async () => {
        if (window.voiceinvoice?.banking) {
            try {
                const data = await window.voiceinvoice.banking.getTransactions();
                setTransactions(data as Transaction[]);
            } catch (err) {
                console.error("Failed to load transactions", err);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const format = file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'MT940';

            try {
                const result = await window.voiceinvoice.banking.importTransactions(content, format, file.name);
                setImportResult(result);
                loadTransactions();
            } catch (err) {
                console.error(err);
                alert('Import fehlgeschlagen: ' + err);
            } finally {
                setLoading(false);
                // Reset input
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-8">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Landmark size={32} />
                    </div>
                    Bank-Synchronisation
                </h1>

                <div className="relative group">
                    <input
                        type="file"
                        accept=".csv,.txt,.sta,.swi"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={loading}
                    />
                    <button className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg",
                        loading ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:shadow-primary/25 hover:translate-y-[-2px]"
                    )}>
                        <Upload size={20} />
                        {loading ? 'Importiere...' : 'Kontoauszug importieren'}
                    </button>
                </div>
             </div>

             {importResult && (
                 <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                     <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                         <CheckCircle size={24} />
                     </div>
                     <div>
                         <p className="font-bold">Import erfolgreich abgeschlossen</p>
                         <p className="text-sm text-muted-foreground">
                             {importResult.imported} Transaktionen importiert, {importResult.skipped} übersprungen (Duplikate).
                         </p>
                     </div>
                 </div>
             )}

             {/* Transaction List */}
             <div className="bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border/50">
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Datum</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Konto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Beschreibung</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Betrag</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {transactions.map(t => (
                                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-muted-foreground whitespace-nowrap">
                                        {new Date(t.date).toLocaleDateString('de-DE')}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold whitespace-nowrap">
                                        {t.bankAccount?.iban ?? 'Unbekannt'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium">{t.senderName || 'Unbekannt'}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-md">{t.description}</div>
                                    </td>
                                    <td className={cn(
                                        "px-6 py-4 text-right font-black text-sm whitespace-nowrap",
                                        t.amount > 0 ? "text-green-600" : "text-foreground"
                                    )}>
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase border",
                                            t.status === 'PENDING' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                            t.status === 'MATCHED' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                            "bg-muted text-muted-foreground border-muted-foreground/20"
                                        )}>
                                            {t.status === 'PENDING' ? 'Offen' : t.status === 'MATCHED' ? 'Zugeordnet' : t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Landmark size={48} className="text-muted-foreground/50 mb-2" />
                                            <p className="font-bold text-foreground">Keine Transaktionen</p>
                                            <p className="text-sm">Importieren Sie einen Kontoauszug (CSV oder MT940), um zu starten.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
    );
}
