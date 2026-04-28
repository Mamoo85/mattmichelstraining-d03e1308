-- Quarantine all pre-validation-gate mortgage radar leads.
-- Reason: every existing row was created BEFORE the Phase A/B/C anti-hallucination
-- system was in place. None have lat/lon (coordinate validation never ran),
-- and a sweep found 74+ rows with placeholder URLs (M12345678, home/87654321,
-- case_number=2024-XXXX, address pattern "999 Willow Way" style fabrications).
-- The original "444 Willow Way Grosse Pointe Woods" hallucination is in here.
--
-- Strategy: do NOT delete (preserve audit trail). Move them all to
-- pipeline_stage = 'quarantined_pre_validation' and clear notified_client_ids
-- so they cannot be surfaced in any digest, alert, or client view.
-- Add a column to record why, and an index for fast filtering.

ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

UPDATE public.mortgage_radar_leads
SET pipeline_stage = 'quarantined_pre_validation',
    quarantine_reason = CASE
      WHEN signal_url ~ '(M[0-9]{8}|home/[0-9]{8}|785000000[0-9]|774000000[0-9]|case_number=2024-XXXX|XXXXXY|XXXXXZ|/87654321|/67890123|/34567890|/23456789|/12345678|/56789012|/99245112|/99243763|/99249717|/98765432|/99999999|/45678901|/78901234|/132123232)'
        THEN 'placeholder_url_pattern'
      WHEN address ~ '^(101|111|121|131|141|151|161|171|181|191|201|211|212|221|222|231|241|251|261|271|281|291|301|311|321|331|333|341|351|361|371|381|391|401|411|421|431|441|444|451|461|471|481|491|501|511|521|531|541|551|555|561|571|581|591|601|611|621|631|641|651|661|666|671|681|691|701|711|721|731|741|751|761|771|777|781|789|791|801|811|821|831|841|851|861|871|881|888|891|901|911|921|931|941|951|961|971|981|991|999) (Elm|Oak|Pine|Maple|Birch|Cedar|Willow|Aspen|Poplar|Riverside|Hawthorne|Sycamore|Spruce|Cherry|Lakeside) (St|Ave|Ln|Ct|Rd|Way|Dr|Pl)$'
        THEN 'fabricated_address_pattern'
      WHEN lat IS NULL OR lon IS NULL
        THEN 'no_coordinate_validation'
      ELSE 'pre_validation_legacy'
    END,
    notified_client_ids = ARRAY[]::uuid[]
WHERE pipeline_stage = 'new';

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_pipeline_stage
  ON public.mortgage_radar_leads(pipeline_stage)
  WHERE pipeline_stage != 'quarantined_pre_validation';
