-- Add actioned_at to outreach_replies for AdminReplyInbox snooze/won actions
alter table outreach_replies
  add column if not exists actioned_at timestamptz;

create index if not exists outreach_replies_actioned_sentiment_idx
  on outreach_replies(sentiment, actioned_at)
  where sentiment = 'positive';
