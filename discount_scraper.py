"""
Discount scraper for David Jones and Iconic
"""
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import time
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DiscountScraper:
    """Base class for discount scrapers"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })

    def scrape(self) -> List[Dict]:
        raise NotImplementedError


class DavidJonesScraper(DiscountScraper):
    """Scraper for David Jones sale items"""

    def __init__(self):
        super().__init__()
        self.base_url = "https://www.davidjones.com"

    def scrape(self) -> List[Dict]:
        """Scrape David Jones for discount items"""
        items = []

        try:
            # Navigate to men's sale section
            sale_url = f"{self.base_url}/mens/sale"
            logger.info(f"Scraping {sale_url}")

            response = self.session.get(sale_url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Find product containers (adjust selector based on actual site structure)
            products = soup.find_all('div', class_=['product', 'product-item'])

            for product in products[:50]:  # Limit to first 50 products
                try:
                    # Extract product details
                    name_elem = product.find(['h2', 'h3', 'a'])
                    price_elem = product.find(class_=['price', 'product-price'])
                    original_price_elem = product.find(class_=['original-price', 'was-price'])
                    category_elem = product.find(class_=['category', 'breadcrumb'])

                    if not name_elem or not price_elem:
                        continue

                    name = name_elem.get_text(strip=True)
                    current_price = price_elem.get_text(strip=True)
                    original_price = original_price_elem.get_text(strip=True) if original_price_elem else "N/A"
                    category = category_elem.get_text(strip=True) if category_elem else "Men"

                    # Calculate discount
                    discount_percent = self._calculate_discount(current_price, original_price)

                    items.append({
                        'source': 'David Jones',
                        'name': name,
                        'current_price': current_price,
                        'original_price': original_price,
                        'discount_percent': discount_percent,
                        'category': category,
                        'gender': 'Men',
                        'url': self._extract_url(product),
                        'scraped_at': datetime.now().isoformat()
                    })

                except Exception as e:
                    logger.warning(f"Error parsing product: {e}")
                    continue

            logger.info(f"Found {len(items)} items from David Jones")

        except Exception as e:
            logger.error(f"Error scraping David Jones: {e}")

        return items

    def _calculate_discount(self, current: str, original: str) -> float:
        """Calculate discount percentage"""
        try:
            current_num = float(current.replace('$', '').replace(',', ''))
            original_num = float(original.replace('$', '').replace(',', ''))
            if original_num > 0:
                return round((1 - current_num / original_num) * 100, 1)
        except:
            pass
        return 0.0

    def _extract_url(self, product) -> str:
        """Extract product URL"""
        link = product.find('a', href=True)
        if link:
            url = link.get('href')
            if url.startswith('http'):
                return url
            return f"{self.base_url}{url}"
        return ""


class IconicScraper(DiscountScraper):
    """Scraper for Iconic discount items"""

    def __init__(self):
        super().__init__()
        self.base_url = "https://www.theiconic.com.au"

    def scrape(self) -> List[Dict]:
        """Scrape Iconic for discount items from first 2 pages"""
        items = []

        try:
            # Navigate to men's clothing sale section
            sale_url = f"{self.base_url}/mens-clothing-sale/"
            logger.info(f"Scraping {sale_url}")

            # Scrape first 2 pages only
            for page in range(1, 3):
                try:
                    page_url = f"{sale_url}?page={page}" if page > 1 else sale_url
                    logger.info(f"Scraping page {page}: {page_url}")

                    # Add referer header
                    headers = {'Referer': self.base_url}
                    response = self.session.get(page_url, headers=headers, timeout=10)
                    response.raise_for_status()

                    soup = BeautifulSoup(response.content, 'html.parser')

                    # Find product containers - look for all divs with product info
                    products = soup.find_all('div', {'class': lambda x: x and 'product' in x.lower()})

                    if not products:
                        logger.warning(f"No products found on page {page}")
                        break

                    for product in products:
                        try:
                            # Extract brand and product name
                            name_elem = product.find(['h2', 'h3', 'a'], {'class': lambda x: x and any(c in str(x).lower() for c in ['name', 'title', 'product'])})

                            # Try to find price elements with specific patterns
                            price_elems = product.find_all(lambda tag: tag.name in ['span', 'div'] and '$' in (tag.get_text(strip=True) or ''))

                            if not name_elem or not price_elems:
                                continue

                            name_text = name_elem.get_text(strip=True)

                            # Extract current and original prices from the price elements
                            prices = [p.get_text(strip=True) for p in price_elems]

                            if len(prices) < 1:
                                continue

                            # Usually the last price is current, others are original
                            current_price = prices[-1] if prices else "N/A"
                            original_price = prices[0] if len(prices) > 1 else "N/A"

                            # Extract category from breadcrumb or sidebar
                            category = self._extract_category(product)

                            # Extract brand name (usually first part before product name or in separate element)
                            brand, product_name = self._parse_brand_name(name_text)

                            # Calculate discount
                            discount_percent = self._calculate_discount(current_price, original_price)

                            items.append({
                                'source': 'The Iconic',
                                'brand': brand,
                                'name': product_name,
                                'current_price': current_price,
                                'original_price': original_price,
                                'discount_percent': discount_percent,
                                'category': category,
                                'gender': 'Men',
                                'url': self._extract_url(product),
                                'scraped_at': datetime.now().isoformat()
                            })

                        except Exception as e:
                            logger.warning(f"Error parsing product: {e}")
                            continue

                    time.sleep(1)  # Be respectful to servers between pages

                except Exception as e:
                    logger.error(f"Error scraping page {page}: {e}")
                    break

            logger.info(f"Found {len(items)} items from The Iconic")

        except Exception as e:
            logger.error(f"Error scraping The Iconic: {e}")

        return items

    def _parse_brand_name(self, text: str) -> tuple:
        """Parse brand and product name from combined text"""
        parts = text.split(maxsplit=1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return "Unknown", text

    def _extract_category(self, product) -> str:
        """Extract category from product element"""
        # Look for category indicators in the product or nearby elements
        category_keywords = ['jeans', 'shorts', 'pants', 'shirt', 'jacket', 'coat', 'shoes', 'accessories']
        text = product.get_text(strip=True).lower()

        for keyword in category_keywords:
            if keyword in text:
                return keyword
        return "Men"

    def _calculate_discount(self, current: str, original: str) -> float:
        """Calculate discount percentage"""
        try:
            current_num = float(current.replace('$', '').replace(',', ''))
            original_num = float(original.replace('$', '').replace(',', ''))
            if original_num > 0:
                return round((1 - current_num / original_num) * 100, 1)
        except:
            pass
        return 0.0

    def _extract_url(self, product) -> str:
        """Extract product URL"""
        link = product.find('a', href=True)
        if link:
            url = link.get('href')
            if url.startswith('http'):
                return url
            return f"{self.base_url}{url}"
        return ""


class DiscountAggregator:
    """Aggregates discounts from multiple sources"""

    def __init__(self):
        self.scrapers = [
            DavidJonesScraper(),
            IconicScraper()
        ]

    def scrape_all(self) -> List[Dict]:
        """Scrape all sources and combine results"""
        all_items = []

        for scraper in self.scrapers:
            try:
                items = scraper.scrape()
                all_items.extend(items)
                time.sleep(1)  # Be respectful to servers
            except Exception as e:
                logger.error(f"Error with {scraper.__class__.__name__}: {e}")

        # Sort by discount percentage (highest first)
        all_items.sort(key=lambda x: x.get('discount_percent', 0), reverse=True)

        return all_items


if __name__ == "__main__":
    aggregator = DiscountAggregator()
    items = aggregator.scrape_all()

    print(f"\nFound {len(items)} discounted items:")
    print(json.dumps(items[:5], indent=2))
