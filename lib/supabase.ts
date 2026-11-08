import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ vars must be referenced literally so Next can inline them into the browser bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart `npm run dev`.",
  );
}

export const supabase = createClient(url, key);
export const BUCKET = "photos";