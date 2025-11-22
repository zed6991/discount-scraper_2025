"""
Vercel Serverless Function - Discount Scraper
"""
from datetime import datetime
import json

def handler(request):
    """Serverless endpoint for scraping discounts"""
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        print('Handling request...', flush=True)

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

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'items': items,
                'total': len(items),
                'timestamp': datetime.now().isoformat()
            }, default=str)
        }

    except Exception as e:
        import traceback
        error_msg = f'Error during scraping: {str(e)}\n{traceback.format_exc()}'
        print(error_msg, flush=True)
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
