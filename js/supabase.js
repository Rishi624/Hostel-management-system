// We import the Supabase client (using a CDN for pure Vanilla JS setup)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://dxzccywrlwojvkrugnyw.supabase.co'
const supabaseKey = 'sb_publishable_GAZRwEcrDOf6738fEQqVOA_HzmbnWZa'

// Export this so other files can talk to the database
export const supabase = createClient(supabaseUrl, supabaseKey)