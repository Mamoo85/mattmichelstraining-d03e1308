-- Soft-delete hire_alert_candidates with junk names scraped from page nav text.
-- Affects rows where name matches: nav phrases, punctuation, too short, or only one token.
-- Sets do_not_contact=true, clears LLM-generated fields, zeroes score.

UPDATE public.hire_alert_candidates
SET
  do_not_contact = true,
  qualifications_summary = NULL,
  hiring_recommendation = NULL,
  score = 0,
  enrichment_status = 'junk'
WHERE
  -- Nav text / single-word UI phrases
  name ~* '^\s*(go\s+back|uh\s+oh|search|loading|submit|sign\s+in|log\s+in|log\s+out|sign\s+out|next|previous|prev|view\s+all|see\s+all|learn\s+more|read\s+more|coming\s+soon|not\s+found|error|menu|home|homepage|click\s+here|back|continue|skip|cancel|close|accept|decline|verify|confirm)\b'
  -- Contains characters that cannot appear in a real name
  OR name ~ '[?:!@#$%/\[\]{}|<>]'
  -- Too short to be a real name
  OR length(trim(name)) < 5
  -- Only one token (no space between first/last name)
  OR array_length(string_to_array(trim(name), ' '), 1) < 2
  -- Looks like a URL or email
  OR name ~* '(https?://|www\.|\.com|\.org|@)'
  -- All caps + suspiciously long (likely a company name or scraped header)
  OR (name = upper(name) AND length(trim(name)) > 20 AND name ~ '[A-Z]{4,}');
