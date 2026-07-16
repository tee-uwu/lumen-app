import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser(u: User | null) {
      if (u) {
        const { data } = await supabase.from("profiles").select("is_banned").eq("id", u.id).maybeSingle();
        if (data?.is_banned) {
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
      }
      setUser(u);
    }

    supabase.auth.getUser().then(({ data }) => {
      checkUser(data.user).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      checkUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
