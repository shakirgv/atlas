-- Atlas: a passport validity rule recorded per destination and passport.
-- Run after 005_route_tools.sql. Safe to run twice.
--
-- Without a rule, Atlas only compares the passport's expiry date with the stay's dates.
-- validity_rule_passport is the passport the rule was checked for: another passport doesn't inherit it.
alter table public.entry_requirements
  add column if not exists validity_rule_months int check (validity_rule_months is null or validity_rule_months between 1 and 24),
  add column if not exists validity_rule_from text check (validity_rule_from is null or validity_rule_from in ('arrival', 'departure')),
  add column if not exists validity_rule_passport char(2);

notify pgrst, 'reload schema';
