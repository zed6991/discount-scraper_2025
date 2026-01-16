"""
Local development server for testing the scraper API
Run with: python dev_server.py
"""
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
from discount_scraper_async import scrape_all_sync

app = Flask(__name__, static_folder='docs')
CORS(app)


@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('docs', path)

# Simple cache
_cache = {'data': None, 'timestamp': None, 'ttl': 900}


@app.route('/api/scrape')
def scrape():
    # Check cache
    if _cache['data'] and _cache['timestamp']:
        age = (datetime.now() - _cache['timestamp']).total_seconds()
        if age < _cache['ttl']:
            return jsonify({
                'success': True,
                'items': _cache['data'],
                'total': len(_cache['data']),
                'timestamp': datetime.now().isoformat(),
                'cached': True,
                'cache_age_seconds': round(age)
            })

    # Scrape fresh data
    start = datetime.now()
    items = scrape_all_sync()
    scrape_time = (datetime.now() - start).total_seconds()

    # Update cache
    _cache['data'] = items
    _cache['timestamp'] = datetime.now()

    return jsonify({
        'success': True,
        'items': items,
        'total': len(items),
        'timestamp': datetime.now().isoformat(),
        'cached': False,
        'scrape_time_seconds': round(scrape_time, 2)
    })


if __name__ == '__main__':
    print("Starting dev server at http://localhost:8080")
    print("API endpoint: http://localhost:8080/api/scrape")
    app.run(debug=True, port=8080)
