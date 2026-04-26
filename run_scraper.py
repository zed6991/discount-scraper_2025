"""
Local scraper — runs all stores (including DJ via Playwright) and pushes to Supabase.
Schedule this with Windows Task Scheduler to keep data fresh.
"""
import os
import sys
import json
from datetime import datetime

# Allow running from any directory
root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root)
sys.path.insert(0, os.path.join(root, 'api'))

from discount_scraper_async import scrape_all_sync
from supabase_client import save_price_history, _product_id

if __name__ == '__main__':
    print(f'[{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}] Starting scrape...', flush=True)

    items = scrape_all_sync()
    print(f'Scraped {len(items)} items', flush=True)

    if not items:
        print('No items scraped — skipping Supabase write', flush=True)
        sys.exit(1)

    # Attach product_id to each item
    for item in items:
        item['product_id'] = _product_id(item)

    saved = save_price_history(items)
    print(f'Pushed {saved} snapshots to Supabase', flush=True)

    # Save a local JSON backup too
    backup_path = os.path.join(root, 'last_scrape.json')
    with open(backup_path, 'w') as f:
        json.dump({'timestamp': datetime.now().isoformat(), 'items': items}, f)
    print(f'Backup saved to {backup_path}', flush=True)
    print('Done.', flush=True)
