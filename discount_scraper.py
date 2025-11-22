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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
        """Scrape Iconic for discount items from first 5 pages"""
        items = []

        try:
            # Navigate to men's clothing sale section
            sale_url = f"{self.base_url}/mens-clothing-sale"
            logger.info(f"Scraping {sale_url}")

            # Scrape first 5 pages
            for page in range(1, 6):
                try:
                    page_url = f"{sale_url}?page={page}" if page > 1 else sale_url
                    logger.info(f"Scraping page {page}: {page_url}")

                    response = self.session.get(page_url, timeout=10)
                    response.raise_for_status()

                    soup = BeautifulSoup(response.content, 'html.parser')

                    # Find product containers (adjust selector based on actual site structure)
                    products = soup.find_all('div', class_=['product', 'product-item', 'ProductCard'])

                    if not products:
                        logger.warning(f"No products found on page {page}")
                        break

                    for product in products:
                        try:
                            # Extract product details
                            name_elem = product.find(['h2', 'h3', 'a'])
                            price_elem = product.find(class_=['price', 'product-price', 'current-price'])
                            original_price_elem = product.find(class_=['original-price', 'was-price', 'strikethrough'])
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
                                'source': 'The Iconic',
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

                    time.sleep(1)  # Be respectful to servers between pages

                except Exception as e:
                    logger.error(f"Error scraping page {page}: {e}")
                    break

            logger.info(f"Found {len(items)} items from The Iconic")

        except Exception as e:
            logger.error(f"Error scraping The Iconic: {e}")

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
