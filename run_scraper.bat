@echo off
cd /d "c:\Users\zaeed\AppData\Local\Programs\Python\Python313\projects\discount-scraper"
set SUPABASE_URL=your_supabase_url_here
set SUPABASE_KEY=your_supabase_key_here
python run_scraper.py >> scraper_log.txt 2>&1
