
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.pitch_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.comp_type AS ENUM ('equity', 'paid', 'revenue_share', 'volunteer');
CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

-- =========================================================
-- shared updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  website TEXT,
  linkedin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Now that user_roles exists, create the signup trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- PITCHES
-- =========================================================
CREATE TABLE public.pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  problem TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  stage TEXT NOT NULL DEFAULT 'idea',
  cover_url TEXT,
  status public.pitch_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pitches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitches TO authenticated;
GRANT ALL ON public.pitches TO service_role;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published pitches are viewable by everyone" ON public.pitches
  FOR SELECT USING (status = 'published');
CREATE POLICY "Founders can view own pitches" ON public.pitches
  FOR SELECT TO authenticated USING (auth.uid() = founder_id);
CREATE POLICY "Users can create own pitches" ON public.pitches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "Founders can update own pitches" ON public.pitches
  FOR UPDATE TO authenticated USING (auth.uid() = founder_id) WITH CHECK (auth.uid() = founder_id);
CREATE POLICY "Founders can delete own pitches" ON public.pitches
  FOR DELETE TO authenticated USING (auth.uid() = founder_id);

CREATE TRIGGER trg_pitches_updated_at BEFORE UPDATE ON public.pitches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pitches_founder ON public.pitches(founder_id);
CREATE INDEX idx_pitches_status_created ON public.pitches(status, created_at DESC);

-- =========================================================
-- PITCH ROLES
-- =========================================================
CREATE TABLE public.pitch_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  comp_type public.comp_type NOT NULL DEFAULT 'equity',
  comp_details TEXT NOT NULL DEFAULT '',
  commitment TEXT NOT NULL DEFAULT 'part-time',
  filled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pitch_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_roles TO authenticated;
GRANT ALL ON public.pitch_roles TO service_role;
ALTER TABLE public.pitch_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles on published pitches are public" ON public.pitch_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.status = 'published')
  );
CREATE POLICY "Founders can view own pitch roles" ON public.pitch_roles
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );
CREATE POLICY "Founders manage own pitch roles insert" ON public.pitch_roles
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );
CREATE POLICY "Founders manage own pitch roles update" ON public.pitch_roles
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );
CREATE POLICY "Founders manage own pitch roles delete" ON public.pitch_roles
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );

CREATE INDEX idx_pitch_roles_pitch ON public.pitch_roles(pitch_id);

-- =========================================================
-- APPLICATIONS
-- =========================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.pitch_roles(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants view own applications" ON public.applications
  FOR SELECT TO authenticated USING (auth.uid() = applicant_id);
CREATE POLICY "Founders view applications to own pitches" ON public.applications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );
CREATE POLICY "Users can apply" ON public.applications
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = applicant_id
    AND EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.status = 'published' AND p.founder_id <> auth.uid())
  );
CREATE POLICY "Applicants can withdraw" ON public.applications
  FOR UPDATE TO authenticated USING (auth.uid() = applicant_id) WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Founders can update applications on own pitches" ON public.applications
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );

CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_applications_applicant ON public.applications(applicant_id);
CREATE INDEX idx_applications_pitch ON public.applications(pitch_id);
CREATE INDEX idx_applications_role ON public.applications(role_id);

-- =========================================================
-- PITCH MEMBERS
-- =========================================================
CREATE TABLE public.pitch_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.pitch_roles(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pitch_id, user_id)
);
GRANT SELECT ON public.pitch_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_members TO authenticated;
GRANT ALL ON public.pitch_members TO service_role;
ALTER TABLE public.pitch_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members of published pitches are public" ON public.pitch_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.status = 'published')
  );
CREATE POLICY "Founders manage members insert" ON public.pitch_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );
CREATE POLICY "Founders manage members delete" ON public.pitch_members
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.founder_id = auth.uid())
  );

CREATE INDEX idx_pitch_members_pitch ON public.pitch_members(pitch_id);
CREATE INDEX idx_pitch_members_user ON public.pitch_members(user_id);
