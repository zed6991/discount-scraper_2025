"""
Vercel Serverless Function - Discount Scraper
"""
from datetime import datetime
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


class handler(BaseHTTPRequestHandler):
    """Serverless endpoint for scraping discounts"""

    def do_GET(self):
        """Handle GET requests"""
        headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }

        self.send_response(200)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()

        try:
            print('Handling GET request...', flush=True)

            # Lazy-load the scraper only when needed
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from discount_scraper import DiscountAggregator

            print('DiscountAggregator imported', flush=True)

            aggregator = DiscountAggregator()
            print('DiscountAggregator created', flush=True)

            items = aggregator.scrape_all()
            print(f'Scraping complete. Found {len(items)} items', flush=True)

            response = {
                'success': True,
                'items': items,
                'total': len(items),
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            import traceback
            error_msg = f'Error during scraping: {str(e)}\n{traceback.format_exc()}'
            print(error_msg, flush=True)
            response = {
                'success': False,
                'error': str(e)
            }

        # Format response with nice indentation
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
