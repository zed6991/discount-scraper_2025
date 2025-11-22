"""
Vercel Serverless Function - Discount Scraper
"""
import sys
import os
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
        print('Starting scrape...')
        aggregator = DiscountAggregator()
        items = aggregator.scrape_all()

        print(f'Scraping complete. Found {len(items)} items')

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
        print(f'Error during scraping: {str(e)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
