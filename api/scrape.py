"""
Vercel Serverless Function - Async Discount Scraper with Caching
"""
from datetime import datetime
import json
from http.server import BaseHTTPRequestHandler

# Simple in-memory cache (persists during warm instances)
_cache = {
    'data': None,
    'timestamp': None,
    'ttl_seconds': 900  # 15 minutes cache
}


def get_cached_data():
    """Return cached data if still valid"""
    if _cache['data'] and _cache['timestamp']:
        age = (datetime.now() - _cache['timestamp']).total_seconds()
        if age < _cache['ttl_seconds']:
            return _cache['data'], age
    return None, 0


def set_cache(data):
    """Store data in cache"""
    _cache['data'] = data
    _cache['timestamp'] = datetime.now()


class handler(BaseHTTPRequestHandler):
    """Serverless endpoint for scraping discounts"""

    def do_GET(self):
        """Handle GET requests"""
        headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300',  # Browser cache 5 mins
        }

        self.send_response(200)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()

        try:
            # Check cache first
            cached_data, cache_age = get_cached_data()

            if cached_data:
                print(f'Serving cached data ({cache_age:.0f}s old)', flush=True)
                response = {
                    'success': True,
                    'items': cached_data,
                    'total': len(cached_data),
                    'timestamp': datetime.now().isoformat(),
                    'cached': True,
                    'cache_age_seconds': round(cache_age)
                }
            else:
                print('Cache miss - scraping fresh data...', flush=True)
                start_time = datetime.now()

                # Lazy-load the async scraper
                import sys
                import os
                sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

                from discount_scraper_async import scrape_all_sync

                items = scrape_all_sync()
                scrape_time = (datetime.now() - start_time).total_seconds()

                print(f'Scraping complete: {len(items)} items in {scrape_time:.2f}s', flush=True)

                # Update cache
                set_cache(items)

                response = {
                    'success': True,
                    'items': items,
                    'total': len(items),
                    'timestamp': datetime.now().isoformat(),
                    'cached': False,
                    'scrape_time_seconds': round(scrape_time, 2)
                }

        except Exception as e:
            import traceback
            error_msg = f'Error during scraping: {str(e)}\n{traceback.format_exc()}'
            print(error_msg, flush=True)
            response = {
                'success': False,
                'error': str(e)
            }

        formatted_response = json.dumps(response, default=str, indent=2)
        self.wfile.write(formatted_response.encode())

    def do_OPTIONS(self):
        """Handle OPTIONS requests"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
