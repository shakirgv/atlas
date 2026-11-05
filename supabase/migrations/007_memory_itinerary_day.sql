-- Atlas: a memory can be linked to one itinerary day.
-- Run after 006_passport_validity_rule.sql. Safe to run twice.
--
-- Without this column, memories still save; only linking one to a day fails, with a message pointing here.
-- Deleting the day keeps the memory and drops the link.
alter table public.memories
  add column if not exists itinerary_day_id uuid references public.itinerary_days on delete set null;

create index if not exists memories_itinerary_day_id_idx on public.memories (itinerary_day_id);

notify pgrst, 'reload schema';
