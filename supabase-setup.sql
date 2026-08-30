-- Supabaseの「SQL Editor」にこの内容を貼り付けて実行してください（コピペでOK）

create table kv_store (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table kv_store enable row level security;

create policy "allow read" on kv_store
  for select using (true);

create policy "allow insert" on kv_store
  for insert with check (true);

create policy "allow update" on kv_store
  for update using (true);
