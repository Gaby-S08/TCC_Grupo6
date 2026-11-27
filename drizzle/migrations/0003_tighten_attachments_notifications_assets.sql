DROP POLICY IF EXISTS "Authenticated users read help attachments" ON storage.objects;
CREATE POLICY "Users read permitted help attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'help-attachments'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (select public.has_role((select auth.uid()), 'admin'))
      OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.photo_path = storage.objects.name)
      OR EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.attachment_path = storage.objects.name)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.avatar_path = storage.objects.name)
    )
  );

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Users notify self or admins; admins notify anyone"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recipient_profile_id = (select public.current_profile_id())
    OR (select public.has_role((select auth.uid()), 'admin'))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.auth_user_id AND ur.role = 'admin'
      WHERE p.id = recipient_profile_id
    )
    OR recipient_profile_id = 'admin-guilherme'
  );

DROP POLICY IF EXISTS "Authenticated users can view assets" ON public.assets;
CREATE POLICY "Users view assets of visible laboratories"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.laboratories l WHERE l.id = assets.laboratory_id)
  );