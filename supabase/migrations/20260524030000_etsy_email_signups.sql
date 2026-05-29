-- etsy_email_signups — GNG storefront email capture (exit-intent popup + inline form)

CREATE TABLE IF NOT EXISTS etsy_email_signups (
  id          bigserial PRIMARY KEY,
  email       text NOT NULL,
  source      text DEFAULT 'exit_popup',  -- 'exit_popup' | 'inline_form'
  coupon_sent boolean DEFAULT false,
  signed_up_at timestamptz DEFAULT now(),
  UNIQUE (email)
);
