import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://bfssufvhawvhfamudyiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-fFgpGR6pBW8SxG5VQRpoA_OgDuFec6';


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

