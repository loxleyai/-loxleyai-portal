import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gpdetzuwppqbmdzzhxnb.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZGV0enV3cHBxYm1kenpoeG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI3NjgsImV4cCI6MjA4NzM1ODc2OH0.nYboWga-l_H1LbHbq3cDACEXNSjS1z8iY8JWHdVV3Vk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
