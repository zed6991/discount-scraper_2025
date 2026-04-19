"""
Vercel Serverless Function - Async Discount Scraper with Caching + Supabase price history
"""
from datetime import datetime
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Multi-slot cache keyed by (stores, genders, categories) tuple
_cache = {}
_CACHE_TTL = 900  # 15 minutes
_CACHE_MAX_SLOTS = 10


def _make_cache_key(stores, genders, category_groups):
    return (
        frozenset(stores) if stores else None,
        frozenset(genders) if genders else None,
        frozenset(category_groups) if category_groups else None,
    )


def get_cached_data(cache_key):
    entry = _cache.get(cache_key)
    if entry:
        age = (datetime.now() - entry['timestamp']).total_seconds()
        if age < _CACHE_TTL:
            return entry['data'], age
        else:
            del _cache[cache_key]
    return None, 0


def set_cache(cache_key, data):
    if len(_cache) >= _CACHE_MAX_SLOTS:
        oldest_key = min(_cache, key=lambda k: _cache[k]['timestamp'])
        del _cache[oldest_key]
    _cache[cache_key] = {'data': data, 'timestamp': datetime.now()}


def _parse_list_param(qs, name):
    values = qs.get(name, [])
    result = []
    for v in values:
        result.extend([x.strip() for x in v.split(',') if x.strip()])
    return result if result else None


def _cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
    }


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/history':
            self._handle_history(parsed)
        else:
            self._handle_scrape(parsed)

    # ------------------------------------------------------------------
    # /api/scrape  — main scrape endpoint
    # ------------------------------------------------------------------
    def _handle_scrape(self, parsed):
        headers = _cors_headers()
        self.send_response(200)
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()

        try:
            qs = parse_qs(parsed.query)
            stores = _parse_list_param(qs, 'stores')
            category_groups = _parse_list_param(qs, 'categories')
            cache_key = _make_cache_key(stores, None, category_groups)

            cached_data, cache_age = get_cached_data(cache_key)

            if cached_data:
                print(f'Serving cached data ({cache_age:.0f}s old)', flush=True)
                response = {
                    'success': True,
                    'items': cached_data,
                    'total': len(cached_data),
                    'timestamp': datetime.now().isoformat(),
                    'cached': True,
                    'cache_age_seconds': round(cache_age),
                }
            else:
                print(f'Cache miss — scraping stores={stores} categories={category_groups}', flush=True)
                start_time = datetime.now()

                root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                api_dir = os.path.dirname(os.path.abspath(__file__))
                if root_dir not in sys.path:
                    sys.path.insert(0, root_dir)
                if api_dir not in sys.path:
                    sys.path.insert(0, api_dir)

                from discount_scraper_async import scrape_all_sync

                items = scrape_all_sync(stores=stores, category_groups=category_groups)
                scrape_time = (datetime.now() - start_time).total_seconds()
                print(f'Scraping complete: {len(items)} items in {scrape_time:.2f}s', flush=True)

                set_cache(cache_key, items)

                # Persist to Supabase (best-effort)
                try:
                    from supabase_client import save_price_history, _product_id
                    save_price_history(items)
                    # Attach stable product_id to each item so the frontend can request history
                    for item in items:
                        item['product_id'] = _product_id(item)
                except Exception as sb_err:
                    print(f'Supabase write skipped: {sb_err}', flush=True)

                response = {
                    'success': True,
                    'items': items,
                    'total': len(items),
                    'timestamp': datetime.now().isoformat(),
                    'cached': False,
                    'scrape_time_seconds': round(scrape_time, 2),
                }

        except Exception as e:
            import traceback
            print(f'Scrape error: {e}\n{traceback.format_exc()}', flush=True)
            response = {'success': False, 'error': str(e)}

        self.wfile.write(json.dumps(response, default=str, indent=2).encode())

    # ------------------------------------------------------------------
    # /api/history?product_id=<id>   — price history for one product
    # /api/history?product_ids=<id1,id2,...>  — batch lookup
    # ------------------------------------------------------------------
    def _handle_history(self, parsed):
        headers = _cors_headers()
        headers['Cache-Control'] = 'public, max-age=60'
        self.send_response(200)
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()

        try:
            api_dir = os.path.dirname(os.path.abspath(__file__))
            if api_dir not in sys.path:
                sys.path.insert(0, api_dir)
            from supabase_client import get_price_history, get_price_history_batch

            qs = parse_qs(parsed.query)

            if 'product_ids' in qs:
                ids_raw = _parse_list_param(qs, 'product_ids')
                data = get_price_history_batch(ids_raw or [])
                response = {'success': True, 'history': data}
            elif 'product_id' in qs:
                pid = qs['product_id'][0]
                rows = get_price_history(pid)
                response = {'success': True, 'product_id': pid, 'history': rows}
            else:
                response = {'success': False, 'error': 'product_id or product_ids required'}

        except Exception as e:
            import traceback
            print(f'History error: {e}\n{traceback.format_exc()}', flush=True)
            response = {'success': False, 'error': str(e)}

        self.wfile.write(json.dumps(response, default=str, indent=2).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
