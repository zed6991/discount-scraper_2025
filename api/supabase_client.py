"""
Supabase price history client.
Upserts products and inserts price snapshots after each scrape.
"""
import hashlib
import json
import os
import urllib.request
import urllib.error
from datetime import datetime

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}


def _request(method: str, path: str, body=None, extra_headers=None) -> dict:
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode() if body is not None else None
    headers = {**_HEADERS, **(extra_headers or {})}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f'Supabase {method} {path} → {e.code}: {e.read().decode()}', flush=True)
        return {}
    except Exception as e:
        print(f'Supabase request error: {e}', flush=True)
        return {}


def _product_id(item: dict) -> str:
    """Stable ID: hash of source + URL so the same product always maps to the same row."""
    key = f"{item.get('source', '')}::{item.get('url', '')}"
    return hashlib.sha1(key.encode()).hexdigest()[:16]


def _parse_price(price_str) -> float | None:
    if not price_str or price_str == 'N/A':
        return None
    try:
        return float(str(price_str).replace('$', '').replace(',', '').strip())
    except (ValueError, TypeError):
        return None


def save_price_history(items: list) -> int:
    """
    Upsert products and insert price snapshots for a list of scraped items.
    Returns the number of snapshots successfully written.
    """
    if not items:
        return 0

    products = []
    snapshots = []

    for item in items:
        pid = _product_id(item)
        current = _parse_price(item.get('current_price'))
        original = _parse_price(item.get('original_price'))

        if current is None:
            continue

        products.append({
            'id': pid,
            'source': item.get('source', ''),
            'brand': item.get('brand', ''),
            'name': item.get('name', ''),
            'url': item.get('url', ''),
            'category': item.get('category', ''),
            'gender': item.get('gender', 'Men'),
        })

        snapshots.append({
            'product_id': pid,
            'current_price': current,
            'original_price': original,
            'discount_percent': item.get('discount_percent'),
        })

    # Upsert products (ignore conflicts — metadata rarely changes)
    if products:
        _request(
            'POST',
            'products?on_conflict=id',
            body=products,
            extra_headers={'Prefer': 'resolution=ignore-duplicates,return=minimal'},
        )

    # Insert price snapshots — the unique index on (product_id, hour) prevents duplicates
    if snapshots:
        _request(
            'POST',
            'price_history?on_conflict=product_id,scraped_at_hour',
            body=snapshots,
            extra_headers={'Prefer': 'resolution=ignore-duplicates,return=minimal'},
        )

    print(f'Supabase: saved {len(snapshots)} price snapshots', flush=True)
    return len(snapshots)


def get_latest_items(stores=None, category_groups=None) -> list:
    """
    Return the latest scraped item for each product from Supabase.
    Joins products + most recent price_history snapshot.
    """
    # Fetch latest snapshot per product using a view or RPC if available,
    # otherwise fetch recent price_history + products separately and merge.
    path = (
        'price_history'
        '?order=scraped_at.desc'
        '&limit=2000'
        '&select=product_id,current_price,original_price,discount_percent,scraped_at,'
        'products(source,brand,name,url,category,gender)'
    )
    rows = _request('GET', path, extra_headers={'Prefer': ''})
    if not isinstance(rows, list):
        return []

    # Deduplicate — keep only the most recent snapshot per product
    seen = set()
    items = []
    for row in rows:
        pid = row.get('product_id')
        if pid in seen:
            continue
        seen.add(pid)
        product = row.get('products') or {}
        source = product.get('source', '')
        category = product.get('category', '')

        if stores and source.lower().replace(' ', '') not in [s.lower().replace(' ', '') for s in stores]:
            continue

        items.append({
            'product_id': pid,
            'source': source,
            'brand': product.get('brand', ''),
            'name': product.get('name', ''),
            'url': product.get('url', ''),
            'category': category,
            'gender': product.get('gender', 'Men'),
            'current_price': f"${row['current_price']:.2f}" if row.get('current_price') else 'N/A',
            'original_price': f"${row['original_price']:.2f}" if row.get('original_price') else 'N/A',
            'discount_percent': row.get('discount_percent', 0),
            'scraped_at': row.get('scraped_at', ''),
        })

    return items


def get_price_history(product_id: str) -> list:
    """Return price history rows for a single product, newest first, last 90 days."""
    path = (
        f'price_history'
        f'?product_id=eq.{product_id}'
        f'&order=scraped_at.desc'
        f'&limit=90'
        f'&select=current_price,original_price,discount_percent,scraped_at'
    )
    result = _request('GET', path, extra_headers={'Prefer': ''})
    return result if isinstance(result, list) else []


def get_price_history_batch(product_ids: list) -> dict:
    """Return price history for multiple products keyed by product_id."""
    if not product_ids:
        return {}
    ids_param = ','.join(product_ids)
    path = (
        f'price_history'
        f'?product_id=in.({ids_param})'
        f'&order=scraped_at.desc'
        f'&limit=500'
        f'&select=product_id,current_price,scraped_at'
    )
    rows = _request('GET', path, extra_headers={'Prefer': ''})
    result = {}
    if isinstance(rows, list):
        for row in rows:
            pid = row['product_id']
            result.setdefault(pid, []).append({
                'price': row['current_price'],
                'scraped_at': row['scraped_at'],
            })
    return result
