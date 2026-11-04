// Copy this file to config.js and add your Supabase project details.
// The anon/publishable key is intended for browser use. Database RLS is the security boundary.
window.CARSIFT_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
  // Where favorites are kept when Supabase is connected: "cloud" (synced to the account) or "local" (this browser only).
  // Users can switch it later from the profile page. Without Supabase, favorites always use localStorage.
  FAVORITES_STORAGE: "cloud",
};
