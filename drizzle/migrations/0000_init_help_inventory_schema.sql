-- 1. Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Profiles table (no role column; roles live in public.user_roles)
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  department text,
  room text,
  lab_id text,
  avatar_path text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- Pre-registered role mapping for migrated & admin-invited accounts (trigger/service-role only)
CREATE TABLE public.pre_registered_roles (
  email text PRIMARY KEY,
  role public.app_role NOT NULL DEFAULT 'user',
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pre_registered_roles TO service_role;

ALTER TABLE public.pre_registered_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles readable by self, admins, or admin contact rows"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = public.profiles.auth_user_id AND ur.role = 'admin'
    )
    OR id = 'admin-guilherme'
  );

CREATE POLICY "Users can update own profile or admins update all"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Laboratories
CREATE TABLE public.laboratories (
  id text PRIMARY KEY,
  name text NOT NULL,
  room text NOT NULL DEFAULT '',
  department text NOT NULL,
  responsible_profile_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laboratories TO authenticated;
GRANT ALL ON public.laboratories TO service_role;

ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active laboratories"
  ON public.laboratories
  FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage laboratories"
  ON public.laboratories
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.user_can_access_lab(_user_id uuid, _lab_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_user_id = _user_id
        AND (
          p.lab_id = _lab_id
          OR p.lab_id IS NULL
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.laboratories l
      JOIN public.profiles p ON p.id = l.responsible_profile_id
      WHERE l.id = _lab_id
        AND p.auth_user_id = _user_id
    )
$$;

-- 4. Assets
CREATE TABLE public.assets (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  laboratory_id text NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assets"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage assets in accessible labs"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_can_access_lab(auth.uid(), laboratory_id));

CREATE POLICY "Users can update assets in accessible labs"
  ON public.assets
  FOR UPDATE
  TO authenticated
  USING (public.user_can_access_lab(auth.uid(), laboratory_id))
  WITH CHECK (public.user_can_access_lab(auth.uid(), laboratory_id));

CREATE POLICY "Users can delete assets in accessible labs"
  ON public.assets
  FOR DELETE
  TO authenticated
  USING (public.user_can_access_lab(auth.uid(), laboratory_id));

-- 5. Tickets
CREATE TABLE public.tickets (
  id text PRIMARY KEY,
  ticket_number bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  requester_profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  laboratory_id text REFERENCES public.laboratories(id) ON DELETE SET NULL,
  asset_id text REFERENCES public.assets(id) ON DELETE SET NULL,
  department text NOT NULL,
  lab_name text NOT NULL,
  asset_name text NOT NULL,
  serial text NOT NULL,
  requester_name text NOT NULL,
  request_type text NOT NULL,
  description text NOT NULL,
  photo_path text,
  status text NOT NULL DEFAULT 'Em Andamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets and admins view all"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    requester_profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users create own tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins update tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Ticket messages
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sender_name text NOT NULL,
  sender_role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket participants view messages"
  ON public.ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = public.ticket_messages.ticket_id
        AND t.requester_profile_id = public.current_profile_id()
    )
  );

CREATE POLICY "Ticket participants send messages"
  ON public.ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_profile_id = public.current_profile_id()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = public.ticket_messages.ticket_id
          AND t.requester_profile_id = public.current_profile_id()
      )
    )
  );

-- 7. Direct messages
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sender_name text NOT NULL,
  message text NOT NULL DEFAULT '',
  attachment_name text,
  attachment_path text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own direct thread and admins view all"
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users send in own thread and admins send in any thread"
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_profile_id = public.current_profile_id()
    AND (
      profile_id = public.current_profile_id()
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Senders or admins update direct messages"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    sender_profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Senders or admins delete direct messages"
  ON public.direct_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_profile_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 8. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  reference_id text,
  text text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_profile_id = public.current_profile_id());

CREATE POLICY "Authenticated users create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_profile_id = public.current_profile_id())
  WITH CHECK (recipient_profile_id = public.current_profile_id());

-- 9. Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_laboratories_updated_at BEFORE UPDATE ON public.laboratories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_direct_messages_updated_at BEFORE UPDATE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Verified-email profile claiming & role assignment trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_existing_profile_id text;
  v_pre_role public.app_role;
  v_display_name text;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_email := lower(trim(NEW.email));

  -- Check if already linked to this auth user
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE auth_user_id = NEW.id
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Check for unambiguous unclaimed pre-registered profile by verified email
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE lower(email) = v_email
    AND auth_user_id IS NULL
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET auth_user_id = NEW.id, updated_at = now()
    WHERE id = v_existing_profile_id;

    SELECT role INTO v_pre_role
    FROM public.pre_registered_roles
    WHERE lower(email) = v_email
    LIMIT 1;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE(v_pre_role, 'user'))
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
  END IF;

  -- New self-registered user gets standard 'user' role and own profile
  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.profiles (id, auth_user_id, name, email, department)
  VALUES (NEW.id::text, NEW.id, v_display_name, v_email, 'Informática')
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_verified_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_verified();

CREATE TRIGGER on_auth_user_verified_update
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_auth_user_verified();

-- 11. Storage RLS policies for private bucket 'help-attachments'
CREATE POLICY "Authenticated users read help attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'help-attachments');

CREATE POLICY "Authenticated users upload own help attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'help-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users update own help attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'help-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users delete own help attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'help-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 12. Initial migrated seed records (identity & profile metadata only; passwords never imported)
INSERT INTO public.profiles (id, name, email, department, room, lab_id, active)
VALUES
  ('admin-guilherme', 'Administrador Guilherme dos Santos', 'guilherme.santos@gmail.com', NULL, NULL, NULL, true),
  ('prof-rafael', 'Professor Rafael Conceição', 'rafael.conceicao@gmail.com', 'Informática', '166', 'lab-166', true),
  ('prof-lucas', 'Professor Lucas Oliveira', 'lucas.oliveira@gmail.com', 'Informática', '221', 'lab-221', true),
  ('prof-maria', 'Professora Maria Julia', 'maria.ju@gmail.com', 'Informática', '094', 'lab-094', true),
  ('prof-luana', 'Professora Luana Silva', 'luana.silva@gmail.com', 'Informática', '265', 'lab-265', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pre_registered_roles (email, role, profile_id)
VALUES
  ('guilherme.santos@gmail.com', 'admin', 'admin-guilherme'),
  ('rafael.conceicao@gmail.com', 'user', 'prof-rafael'),
  ('lucas.oliveira@gmail.com', 'user', 'prof-lucas'),
  ('maria.ju@gmail.com', 'user', 'prof-maria'),
  ('luana.silva@gmail.com', 'user', 'prof-luana')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.laboratories (id, name, room, department, responsible_profile_id, active)
VALUES
  ('lab-166', 'Laboratório de Informática · Sala 166', '166', 'Informática', 'prof-rafael', true),
  ('lab-221', 'Laboratório de Informática · Sala 221', '221', 'Informática', 'prof-lucas', true),
  ('lab-094', 'Laboratório de Informática · Sala 094', '094', 'Informática', 'prof-maria', true),
  ('lab-265', 'Laboratório de Informática · Sala 265', '265', 'Informática', 'prof-luana', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assets (id, code, laboratory_id, name, description, quantity, status)
VALUES
  ('a166-001', 'INF-166-001', 'lab-166', 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10, 'available'),
  ('a221-001', 'INF-221-001', 'lab-221', 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10, 'available'),
  ('a094-001', 'INF-094-001', 'lab-094', 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10, 'available'),
  ('a265-001', 'INF-265-001', 'lab-265', 'Computador de bancada', 'Estação de trabalho para aulas de informática.', 10, 'available')
ON CONFLICT (id) DO NOTHING;