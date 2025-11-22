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
                        'brand': 'Unknown',
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
        # Clothing categories to scrape
        self.categories = {
            'Shirts & Polos': 'mens-clothing-shirts-polos-sale/',
            'T-Shirts & Singlets': 'mens-clothing-t-shirts-singlets-sale/',
            'Coats & Jackets': 'mens-clothing-coats-jackets-sale/',
            'Pants': 'mens-clothing-pants-sale/',
            'Sweats & Hoodies': 'mens-clothing-sweats-hoodies-sale/',
            'Jumpers & Cardigans': 'mens-clothing-jumpers-cardigans-sale/',
            'Jeans': 'mens-clothing-jeans-sale/',
            'Shorts': 'mens-clothing-shorts-sale/',
            'Suits & Blazers': 'mens-clothing-suits-blazers-sale/',
            'Swimwear': 'mens-clothing-swimwear-sale/',
            'Loungewear': 'mens-clothing-loungewear-sale/',
            'Underwear': 'mens-clothing-underwear-sale/',
            'Socks': 'mens-clothing-socks-sale/',
            'Sleepwear': 'mens-clothing-sleepwear-sale/',
            'Base Layers': 'mens-clothing-base-layers-sale/',
            'Underwear & Socks': 'mens-clothing-underwear-socks-sale/',
            'Socks & Stockings': 'mens-clothing-socks-stockings-sale/',
        }

    def scrape(self) -> List[Dict]:
        """Scrape Iconic for discount items from all clothing categories"""
        items = []

        try:
            # Scrape each category
            for category_name, category_path in self.categories.items():
                try:
                    sale_url = f"{self.base_url}/{category_path}"
                    logger.info(f"Scraping {category_name}: {sale_url}")

                    # Scrape first page of each category only
                    page_url = sale_url
                    logger.info(f"Scraping {category_name}: {page_url}")

                    # Add referer header
                    headers = {'Referer': self.base_url}
                    response = self.session.get(page_url, headers=headers, timeout=10)
                    response.raise_for_status()

                    soup = BeautifulSoup(response.content, 'html.parser')

                    # Find product containers - look for divs that contain product cards
                    product_divs = soup.find_all('div', class_=lambda x: x and 'ProductCard' in str(x) or 'product-item' in str(x))

                    # If specific class not found, look for any div that has both text and prices
                    if not product_divs:
                        product_divs = soup.find_all('div', class_=lambda x: x and ('col' in str(x).lower() or 'item' in str(x).lower()))

                    if not product_divs:
                        logger.warning(f"No products found for {category_name}")
                        continue

                    for product_div in product_divs:
                        try:
                            # Extract brand using class="brand"
                            brand_elem = product_div.find('span', class_='brand')
                            if not brand_elem:
                                continue
                            brand_name = brand_elem.get_text(strip=True)

                            # Extract product name using class="name"
                            name_elem = product_div.find('span', class_='name')
                            if not name_elem:
                                continue
                            product_name = name_elem.get_text(strip=True)

                            # Extract original price using class="price original"
                            original_price_elem = product_div.find('span', class_='price original')
                            original_price = "N/A"
                            if original_price_elem:
                                # Get text content and extract price
                                price_text = original_price_elem.get_text(strip=True)
                                # Extract just the price number
                                original_price = price_text if '$' in price_text else "N/A"

                            # Extract current/final price using class="price final"
                            current_price_elem = product_div.find('span', class_='price final')
                            if not current_price_elem:
                                continue
                            current_price_text = current_price_elem.get_text(strip=True)
                            current_price = current_price_text if '$' in current_price_text else "N/A"

                            if current_price == "N/A":
                                continue

                            # Calculate discount
                            discount_percent = self._calculate_discount(current_price, original_price)

                            items.append({
                                'source': 'The Iconic',
                                'brand': brand_name,
                                'name': product_name,
                                'current_price': current_price,
                                'original_price': original_price,
                                'discount_percent': discount_percent,
                                'category': category_name,
                                'gender': 'Men',
                                'url': self._extract_url(product_div),
                                'scraped_at': datetime.now().isoformat()
                            })

                        except Exception as e:
                            logger.warning(f"Error parsing product: {e}")
                            continue

                    time.sleep(1)  # Be respectful to servers between categories

                except Exception as e:
                    logger.error(f"Error scraping category {category_name}: {e}")
                    continue

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
