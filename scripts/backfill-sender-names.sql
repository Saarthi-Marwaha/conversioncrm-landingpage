-- Backfill sender display names for workspaces created before migration 012
update workspaces
set email_sender_name = coalesce(nullif(trim(product_name), ''), nullif(trim(name), ''))
where email_sender_name is null
  and (product_name is not null or name is not null);

select id, name, product_name, email_sender_name, reply_to_email
from workspaces
order by created_at;
