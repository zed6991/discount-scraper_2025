"""
Vercel Serverless Function - Discount Scraper
"""
import sys
import os
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from discount_scraper import DiscountAggregator
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
        print('Starting scrape...', flush=True)
        print(f'Python path: {sys.path}', flush=True)
        print(f'Current directory: {os.getcwd()}', flush=True)
        print(f'Files in current dir: {os.listdir(".")}', flush=True)

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
        error_msg = f'Error during scraping: {str(e)}\n{traceback.format_exc()}'
        print(error_msg, flush=True)
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            })
        }
