/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Simple CSV parser — split by lines, first line is headers
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
  return { headers, rows };
}

function downloadTemplate(filename: string, headers: string[]) {
  const exampleRow = headers.map(() => '').join(',');
  const csv = [headers.join(','), exampleRow].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ImportType = 'customers' | 'assets' | 'jobs';

interface ImportConfig {
  label: string;
  templateFile: string;
  templateHeaders: string[];
  requiredFields: string[];
  optionalFields: string[];
}

const IMPORT_CONFIGS: Record<ImportType, ImportConfig> = {
  customers: {
    label: 'Customers',
    templateFile: 'customers-template.csv',
    templateHeaders: ['company_name', 'contact_name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'notes'],
    requiredFields: ['company_name', 'contact_name'],
    optionalFields: ['phone', 'email', 'address', 'city', 'state', 'zip', 'notes'],
  },
  assets: {
    label: 'Assets',
    templateFile: 'assets-template.csv',
    templateHeaders: ['name', 'asset_type', 'manufacturer', 'model', 'serial_number', 'install_date', 'location_notes'],
    requiredFields: ['name'],
    optionalFields: ['asset_type', 'manufacturer', 'model', 'serial_number', 'install_date', 'location_notes'],
  },
  jobs: {
    label: 'Job History',
    templateFile: 'job-history-template.csv',
    templateHeaders: ['title', 'description', 'status', 'scheduled_date', 'completed_at', 'notes'],
    requiredFields: ['title'],
    optionalFields: ['description', 'status', 'scheduled_date', 'completed_at', 'notes'],
  },
};

interface ColumnMapping {
  [field: string]: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
}

export default function DWADataImport() {
  const [activeType, setActiveType] = useState<ImportType>('customers');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = IMPORT_CONFIGS[activeType];

  const { data: clients = [] } = useQuery({
    queryKey: ['dwa-clients-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_crm_clients')
        .select('id, business_name')
        .eq('status', 'active')
        .order('business_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  function handleTabChange(type: ImportType) {
    setActiveType(type);
    setCsvData(null);
    setMapping({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        toast.error('Could not parse CSV — make sure the file has headers and at least one data row');
        return;
      }
      setCsvData(parsed);
      setResult(null);
      // Auto-map columns where header names match exactly
      const autoMap: ColumnMapping = {};
      const allFields = [...config.requiredFields, ...config.optionalFields];
      for (const field of allFields) {
        if (parsed.headers.includes(field)) {
          autoMap[field] = field;
        }
      }
      setMapping(autoMap);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!selectedClientId) { toast.error('Select a client first'); return; }
    if (!csvData) { toast.error('Upload a CSV file first'); return; }

    // Validate at least one required field is mapped
    const hasRequired = config.requiredFields.some(f => mapping[f]);
    if (!hasRequired) {
      toast.error(`Map at least one required field: ${config.requiredFields.join(' or ')}`);
      return;
    }

    setImporting(true);
    let imported = 0;
    let skipped = 0;

    try {
      const allFields = [...config.requiredFields, ...config.optionalFields];

      const records = csvData.rows.map(row => {
        const record: Record<string, string | null> = { client_id: selectedClientId };
        for (const field of allFields) {
          const csvCol = mapping[field];
          record[field] = csvCol ? (row[csvCol] || null) : null;
        }
        return record;
      });

      // Filter out rows missing all required fields
      const validRecords = records.filter(r => {
        return config.requiredFields.some(f => r[f]);
      });
      skipped = records.length - validRecords.length;

      if (validRecords.length === 0) {
        toast.error('No valid records to import — check required field mapping');
        setImporting(false);
        return;
      }

      const tableName =
        activeType === 'customers' ? 'field_service_customers' :
        activeType === 'assets' ? 'field_service_assets' :
        'field_service_jobs';

      // For jobs, default status to 'completed' if blank
      if (activeType === 'jobs') {
        for (const r of validRecords) {
          if (!r.status) r.status = 'completed';
        }
      }

      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < validRecords.length; i += chunkSize) {
        const chunk = validRecords.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).insert(chunk);
        if (error) throw error;
        imported += chunk.length;
      }

      setResult({ imported, skipped });
      toast.success(`Import complete: ${imported} records imported`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const allFields = [...config.requiredFields, ...config.optionalFields];
  const previewRows = csvData?.rows.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* Import type tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {(Object.keys(IMPORT_CONFIGS) as ImportType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTabChange(type)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeType === type
                ? 'border-[#00d4ff] text-[#00d4ff]'
                : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/20'
            }`}
          >
            {IMPORT_CONFIGS[type].label}
          </button>
        ))}
      </div>

      {/* Step 1: Select client */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
          1. Select Client
        </p>
        <select
          className="w-full max-w-xs bg-[#0a1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00d4ff]/50"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">— Choose a client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.business_name}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Download template + upload */}
      <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
          2. Upload CSV File
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={() => downloadTemplate(config.templateFile, config.templateHeaders)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 hover:text-white transition-colors"
          >
            Download Template
          </button>
          <span className="text-white/30 text-xs">or upload your own CSV with matching column names</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="block text-sm text-white/60 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#00d4ff]/10 file:text-[#00d4ff] hover:file:bg-[#00d4ff]/20 file:cursor-pointer"
        />
        {csvData && (
          <p className="mt-3 text-white/50 text-xs">
            {csvData.rows.length} rows detected &bull; {csvData.headers.length} columns
          </p>
        )}
      </div>

      {/* Step 3: Preview + column mapping */}
      {csvData && csvData.rows.length > 0 && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 space-y-5">
          <p className="text-white/40 text-xs uppercase tracking-widest">
            3. Preview &amp; Map Columns
          </p>

          {/* Preview table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {csvData.headers.map(h => (
                    <th key={h} className="text-left px-3 py-2 text-white/40 font-medium uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {csvData.headers.map(h => (
                      <td key={h} className="px-3 py-2 text-white/60 whitespace-nowrap max-w-[160px] truncate">
                        {row[h] || <span className="text-white/20">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.rows.length > 5 && (
              <p className="text-white/30 text-xs mt-2 px-3">
                Showing 5 of {csvData.rows.length} rows
              </p>
            )}
          </div>

          {/* Column mapping */}
          <div>
            <p className="text-white/50 text-xs mb-3">Map CSV columns to import fields:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allFields.map(field => (
                <div key={field}>
                  <label className="block text-xs mb-1">
                    <span className="text-white/70 font-medium">{field}</span>
                    {config.requiredFields.includes(field) && (
                      <span className="text-[#00d4ff] ml-1">*</span>
                    )}
                  </label>
                  <select
                    className="w-full bg-[#0a1628] border border-white/10 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#00d4ff]/50"
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping(m => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">— skip —</option>
                    {csvData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {activeType === 'assets' && (
              <p className="text-white/30 text-xs mt-3">
                Note: Assets will not be linked to customers automatically — do that after import.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Import */}
      {csvData && csvData.rows.length > 0 && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
            4. Import
          </p>

          {result ? (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                <span>&#10003;</span>
                <span>{result.imported} imported</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                  <span>&#9888;</span>
                  <span>{result.skipped} skipped (missing required fields)</span>
                </div>
              )}
              <button
                onClick={() => { setResult(null); setCsvData(null); setMapping({}); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="ml-auto px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors"
              >
                Import Another File
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-white/60 text-sm">
                Ready to import <strong className="text-white">{csvData.rows.length}</strong> records into{' '}
                <strong className="text-white">{config.label}</strong>
              </span>
              <button
                onClick={handleImport}
                disabled={importing || !selectedClientId}
                className="px-6 py-2.5 rounded-lg bg-[#00d4ff] text-[#0a1628] font-semibold text-sm hover:bg-[#00d4ff]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : `Import ${csvData.rows.length} Records`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
