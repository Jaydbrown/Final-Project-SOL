-- Run once in Supabase SQL editor if chat uses `dao_chat_messages` with Supabase realtime.
alter table public.dao_chat_messages
  add column if not exists attachment_url text;
