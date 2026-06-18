import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pujmweztjjujgmygdoxi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1am13ZXp0amp1amdteWdkb3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzIyNzIsImV4cCI6MjA5MDEwODI3Mn0.RX8TvI6l8BLyTtvDlYXUIN_yTNAVEGxXaUuy6GFqIMw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
