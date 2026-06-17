import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import clientdata from "../client/clienttinfo.json"


export const supabase = createClient(clientdata.Database.supabase.url, clientdata.Database.supabase.anon_key);

