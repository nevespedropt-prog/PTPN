-- v36: only real push services can be saved as a notification endpoint.
-- Stops a signed-in user making the send-push function call an arbitrary address.
-- Re-runnable.
alter table public.push_subscriptions drop constraint if exists push_endpoint_host_ok;
alter table public.push_subscriptions add constraint push_endpoint_host_ok check (
  endpoint ~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/[^\s]*$'
);
