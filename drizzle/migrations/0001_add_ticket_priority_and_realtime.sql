ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Média'
  CHECK (priority IN ('Baixa', 'Média', 'Alta'));

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.tickets,
  public.ticket_messages,
  public.direct_messages,
  public.notifications,
  public.assets,
  public.laboratories;