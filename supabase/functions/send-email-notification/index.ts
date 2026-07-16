import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.user_id) {
      return new Response("Missing record or user_id", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the user's email using the admin client
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
    
    if (error || !user?.email) {
      console.error("Error fetching user:", error);
      return new Response(JSON.stringify({ error: "User or email not found" }), { status: 400 });
    }

    const appUrl = "http://localhost:8000"; // Assuming local or replace with prod URL

    const data = await resend.emails.send({
      from: "Lumen Notifications <onboarding@resend.dev>",
      to: user.email, 
      subject: record.title,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; margin-top: 0;">${record.title}</h2>
          <p style="color: #555; line-height: 1.5; font-size: 16px;">${record.content}</p>
          ${record.link ? `
            <div style="margin-top: 30px;">
              <a href="${appUrl}${record.link}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Details
              </a>
            </div>
          ` : ''}
        </div>
      `
    });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
