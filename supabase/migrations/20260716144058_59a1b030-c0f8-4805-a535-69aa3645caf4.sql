
ALTER TABLE public.pitches
  ADD CONSTRAINT pitches_founder_profile_fkey
  FOREIGN KEY (founder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_applicant_profile_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
