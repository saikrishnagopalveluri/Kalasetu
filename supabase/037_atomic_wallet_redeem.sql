-- KalaWallet.redeem() previously read the balance, checked it in JS, then
-- inserted the debit as two separate round-trips — two concurrent
-- redemptions each individually valid against the same starting balance
-- could both succeed and take the balance negative. Not currently
-- exploitable (redeem() isn't wired to any route yet), but must be fixed
-- before any redemption feature is shipped.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Fix: do the balance check and the debit insert as one atomic operation,
-- serialized per-user via a transaction-scoped advisory lock so two
-- concurrent calls for the same user can never both pass the check.

create or replace function redeem_kalapoints(p_user_id uuid, p_amount integer, p_description text)
returns boolean
language plpgsql
as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    return false;
  end if;

  -- Serializes concurrent redemptions for the same user within this
  -- transaction; released automatically when the calling transaction ends.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(amount), 0) into v_balance
  from wallet_transactions where user_id = p_user_id;

  if p_amount > v_balance then
    return false;
  end if;

  insert into wallet_transactions (user_id, amount, type, description)
  values (p_user_id, -p_amount, 'REDEMPTION', p_description);

  return true;
end;
$$;
