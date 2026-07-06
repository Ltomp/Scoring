import { DropboxConfig } from "./share/payloads";

/**
 * Default card drop-box, shared by trips created with this build of the
 * app — so organisers don't need to create their own Supabase project or
 * paste in a URL/key. Safe to commit: this is Supabase's public "anon"
 * key, meant for client-side use; the actual security boundary is the
 * per-trip write/read keys minted at trip creation and enforced by the
 * SECURITY DEFINER functions in supabase/schema.sql (the tables
 * themselves are unreachable via this key). The secret service_role key
 * is never used by this app and must never be entered here.
 *
 * Organisers can still point a trip at a different Supabase project from
 * the New Trip screen — this is only the default.
 */
export const DEFAULT_DROPBOX: DropboxConfig = {
  url: "https://kycusgqyhocygwspybav.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y3VzZ3F5aG9jeWd3c3B5YmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjMwNTMsImV4cCI6MjA5ODgzOTA1M30.vEJyCviB1FnBmGG_Pp0i-JRKrL9oKe9RkewF90Qgcqk",
};
