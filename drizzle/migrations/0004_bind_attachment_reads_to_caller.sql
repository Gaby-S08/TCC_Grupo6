DROP POLICY IF EXISTS "Users read permitted help attachments" ON storage.objects;

CREATE POLICY "Users read permitted help attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'help-attachments'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR (select public.has_role((select auth.uid()), 'admin'))
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.photo_path = storage.objects.name
          AND t.requester_profile_id = (select public.current_profile_id())
      )
      OR EXISTS (
        SELECT 1 FROM public.direct_messages d
        WHERE d.attachment_path = storage.objects.name
          AND (
            d.profile_id = (select public.current_profile_id())
            OR d.sender_profile_id = (select public.current_profile_id())
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.avatar_path = storage.objects.name
          AND (
            p.auth_user_id = (select auth.uid())
            OR p.id = (select public.current_profile_id())
            OR EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = p.auth_user_id AND ur.role = 'admin'
            )
            OR p.id = 'admin-guilherme'
          )
      )
    )
  );