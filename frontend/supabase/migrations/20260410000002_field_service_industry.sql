ALTER TABLE field_service_clients
ADD COLUMN IF NOT EXISTS industry text DEFAULT 'field_service';
-- Examples: hvac, plumbing, electrical, boiler, appliance_repair, it_support, pest_control, landscaping, fire_protection, other
