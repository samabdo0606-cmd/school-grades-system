import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vkksxqaufdtqdvukymjs.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_T9H7Gpy3Y4OgaKl0g1fXMA_4_Tra_ln";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);0
