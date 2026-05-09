// Talent Ingest Pipeline — types shared between scanners and the talent-ingest fn

export interface RawCandidate {
  source: string;            // 'fmcsa_safer' | 'npi_registry' | 'sonar' | 'apollo' | etc.
  source_record_id?: string; // DOT, NPI, etc. — for idempotency at raw-audit layer
  source_url?: string;
  observed_at?: string;      // ISO timestamp; defaults to now()

  full_name: string;
  trade?: string;
  license_type?: string;
  license_number?: string;
  license_expiry?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  current_employer?: string;
  current_title?: string;
  is_company_name?: boolean;
  raw_data?: Record<string, unknown>;
}

export interface IngestRequest {
  source: string;
  run_id?: string;
  replay_url?: string;
  candidates: RawCandidate[];
}

export interface IngestResult {
  ok: boolean;
  run_id: string;
  inserted: number;
  merged: number;
  rejected: number;
  errors: number;
  hot_alerts: number;
}

export interface ProvenanceEntry {
  source: string;
  source_url?: string;
  source_record_id?: string;
  observed_at: string;
}
