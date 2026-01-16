"""
Async Discount scraper for multiple stores: The Iconic, ASOS, Myer
Uses asyncio + aiohttp for parallel requests - 5-10x faster than sync version
"""
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
from datetime import datetime
from typing import List, Dict
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common headers for all requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}

# Store configuration - which stores to scrape
ENABLED_STORES = ['iconic', 'asos', 'myer', 'jbhifi', 'davidjones']  # Add/remove stores here


class AsyncDiscountScraper:
    """Async scraper that fetches all categories in parallel"""

    def __init__(self):
        self.iconic_url = "https://www.theiconic.com.au"
        self.asos_url = "https://www.asos.com"
        self.myer_url = "https://www.myer.com.au"
        self.jbhifi_url = "https://www.jbhifi.com.au"
        self.davidjones_url = "https://www.davidjones.com"

        self.iconic_categories = {
            # Clothing
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
            # Shoes
            'Sneakers': 'mens-shoes-sneakers-sale/',
            'Boots': 'mens-shoes-boots-sale/',
            'Casual Shoes': 'mens-shoes-casual-shoes-sale/',
            'Dress Shoes': 'mens-shoes-dress-shoes-sale/',
            'Sandals & Thongs': 'mens-shoes-sandals-thongs-sale/',
            'Slip Ons & Loafers': 'mens-shoes-slip-ons-loafers-sale/',
        }

        # ASOS categories (AU site)
        self.asos_categories = {
            'T-Shirts': 'au/men/sale/t-shirts-vests/cat/?cid=5990',
            'Shirts': 'au/men/sale/shirts/cat/?cid=5988',
            'Hoodies & Sweatshirts': 'au/men/sale/hoodies-sweatshirts/cat/?cid=5979',
            'Jackets & Coats': 'au/men/sale/jackets-coats/cat/?cid=3606',
            'Jeans': 'au/men/sale/jeans/cat/?cid=4208',
            'Trousers & Chinos': 'au/men/sale/trousers-chinos/cat/?cid=4910',
            'Shorts': 'au/men/sale/shorts/cat/?cid=7078',
            'Knitwear': 'au/men/sale/jumpers-cardigans/cat/?cid=7617',
            'Shoes': 'au/men/sale/shoes/cat/?cid=6930',
            'Trainers': 'au/men/sale/shoes/trainers/cat/?cid=5775',
        }

        # Myer categories
        self.myer_categories = {
            'Shirts': 'men/shirts',
            'T-Shirts': 'men/t-shirts',
            'Jackets & Coats': 'men/jackets-coats',
            'Pants': 'men/pants',
            'Jeans': 'men/jeans',
            'Knitwear': 'men/knitwear',
            'Shorts': 'men/shorts',
            'Suits': 'men/suits',
            'Shoes': 'men/shoes',
        }

        # JB Hi-Fi categories (electronics/tech deals)
        self.jbhifi_categories = {
            'Laptops': 'collections/computers-tablets-laptops?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Headphones': 'collections/headphones?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Speakers': 'collections/speakers?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'TVs': 'collections/tvs?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Phones': 'collections/mobile-phones?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Gaming': 'collections/gaming?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Cameras': 'collections/cameras?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Smart Home': 'collections/smart-home?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Wearables': 'collections/wearable-technology?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
            'Audio': 'collections/hi-fi-turntables?q=&hPP=60&idx=shopify_products_price_asc&p=0&fR[named_tags.on_sale][0]=true',
        }

        # David Jones categories (men's sale - multiple pages for more coverage)
        self.davidjones_categories = {
            # Clothing (12 pages)
            'Clothing': 'sale/men/clothing',
            'Clothing Page 2': 'sale/men/clothing?page=2',
            'Clothing Page 3': 'sale/men/clothing?page=3',
            'Clothing Page 4': 'sale/men/clothing?page=4',
            'Clothing Page 5': 'sale/men/clothing?page=5',
            'Clothing Page 6': 'sale/men/clothing?page=6',
            'Clothing Page 7': 'sale/men/clothing?page=7',
            'Clothing Page 8': 'sale/men/clothing?page=8',
            'Clothing Page 9': 'sale/men/clothing?page=9',
            'Clothing Page 10': 'sale/men/clothing?page=10',
            'Clothing Page 11': 'sale/men/clothing?page=11',
            'Clothing Page 12': 'sale/men/clothing?page=12',
            # Shoes (6 pages)
            'Shoes': 'sale/men/shoes',
            'Shoes Page 2': 'sale/men/shoes?page=2',
            'Shoes Page 3': 'sale/men/shoes?page=3',
            'Shoes Page 4': 'sale/men/shoes?page=4',
            'Shoes Page 5': 'sale/men/shoes?page=5',
            'Shoes Page 6': 'sale/men/shoes?page=6',
            # Accessories (4 pages)
            'Accessories': 'sale/men/accessories',
            'Accessories Page 2': 'sale/men/accessories?page=2',
            'Accessories Page 3': 'sale/men/accessories?page=3',
            'Accessories Page 4': 'sale/men/accessories?page=4',
            # Bags (3 pages)
            'Bags': 'sale/men/bags',
            'Bags Page 2': 'sale/men/bags?page=2',
            'Bags Page 3': 'sale/men/bags?page=3',
            # Suits (3 pages)
            'Suits': 'sale/men/suits',
            'Suits Page 2': 'sale/men/suits?page=2',
            'Suits Page 3': 'sale/men/suits?page=3',
            # Underwear (2 pages)
            'Underwear': 'sale/men/underwear',
            'Underwear Page 2': 'sale/men/underwear?page=2',
            # Clearance (3 pages - often best deals)
            'Clearance': 'sale/men/clearance',
            'Clearance Page 2': 'sale/men/clearance?page=2',
            'Clearance Page 3': 'sale/men/clearance?page=3',
        }

    async def fetch_page(self, session: aiohttp.ClientSession, url: str, referer: str = None) -> str:
        """Fetch a single page asynchronously"""
        headers = HEADERS.copy()
        if referer:
            headers['Referer'] = referer

        try:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as response:
                if response.status == 200:
                    return await response.text()
                else:
                    logger.warning(f"Got status {response.status} for {url}")
                    return ""
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return ""

    def parse_iconic_category(self, html: str, category_name: str) -> List[Dict]:
        """Parse Iconic HTML for a single category"""
        items = []
        if not html:
            return items

        soup = BeautifulSoup(html, 'lxml')

        # Find all brand spans - each one represents a product
        brand_spans = soup.find_all('span', class_='brand')

        for brand_elem in brand_spans:
            try:
                brand_name = brand_elem.get_text(strip=True)
                if not brand_name:
                    continue

                # Navigate up to find the product card container (the anchor tag parent)
                product_link = brand_elem.find_parent('a')
                if not product_link:
                    continue

                # Get the URL directly from the anchor
                url = product_link.get('href', '')
                if not url or url == '#':
                    continue
                if not url.startswith('http'):
                    url = f"{self.iconic_url}{url}"

                # Find name within the same anchor
                name_elem = product_link.find('span', class_='name')
                if not name_elem:
                    continue
                product_name = name_elem.get_text(strip=True)

                # Find prices - need to look for exact class matches
                # The prices should be within the same product link or its parent
                product_container = product_link.parent

                # Find original price (class contains both 'price' and 'original')
                original_price = "N/A"
                original_price_elem = product_container.find('span', class_=lambda x: x and 'price' in x and 'original' in x)
                if original_price_elem:
                    price_text = original_price_elem.get_text(strip=True)
                    original_price = price_text if '$' in price_text else "N/A"

                # Find current/final price (class contains both 'price' and 'final')
                current_price_elem = product_container.find('span', class_=lambda x: x and 'price' in x and 'final' in x)
                if not current_price_elem:
                    continue
                current_price_text = current_price_elem.get_text(strip=True)
                current_price = current_price_text if '$' in current_price_text else "N/A"

                if current_price == "N/A":
                    continue

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
                    'url': url,
                    'scraped_at': datetime.now().isoformat()
                })
            except Exception as e:
                logger.warning(f"Error parsing Iconic product: {e}")
                continue

        return items

    def parse_asos_category(self, html: str, category_name: str) -> List[Dict]:
        """Parse ASOS HTML for a single category"""
        items = []
        if not html:
            return items

        soup = BeautifulSoup(html, 'lxml')

        # ASOS uses article elements for products
        products = soup.find_all('article', {'data-auto-id': 'productTile'})
        if not products:
            # Fallback to other selectors
            products = soup.find_all('div', class_=lambda x: x and 'productTile' in str(x))

        for product in products[:50]:
            try:
                # Find product link
                link = product.find('a', href=True)
                if not link:
                    continue

                url = link.get('href', '')
                if not url.startswith('http'):
                    url = f"{self.asos_url}{url}"

                # Find brand and name
                # ASOS structure: brand is in h2, name is in a p or div
                brand_elem = product.find('h2') or product.find('span', class_=lambda x: x and 'brand' in str(x).lower())
                name_elem = product.find('p') or product.find('div', class_=lambda x: x and 'title' in str(x).lower())

                brand_name = brand_elem.get_text(strip=True) if brand_elem else 'ASOS'
                product_name = name_elem.get_text(strip=True) if name_elem else ''

                if not product_name:
                    # Try to get from link title
                    product_name = link.get('title', '') or link.get_text(strip=True)

                # Find prices - ASOS uses various price containers
                price_container = product.find('div', class_=lambda x: x and 'price' in str(x).lower())
                if not price_container:
                    price_container = product

                # Look for sale price and original price
                sale_price_elem = price_container.find('span', class_=lambda x: x and ('sale' in str(x).lower() or 'current' in str(x).lower()))
                original_price_elem = price_container.find('span', class_=lambda x: x and ('rrp' in str(x).lower() or 'previous' in str(x).lower()))

                if not sale_price_elem:
                    # Try to find any price
                    all_prices = price_container.find_all('span', string=re.compile(r'\$[\d,]+\.?\d*'))
                    if len(all_prices) >= 2:
                        sale_price_elem = all_prices[0]
                        original_price_elem = all_prices[1]
                    elif len(all_prices) == 1:
                        sale_price_elem = all_prices[0]

                if not sale_price_elem:
                    continue

                current_price = sale_price_elem.get_text(strip=True)
                original_price = original_price_elem.get_text(strip=True) if original_price_elem else "N/A"

                # Clean up prices
                current_price = self._clean_price(current_price)
                original_price = self._clean_price(original_price)

                if not current_price or current_price == "N/A":
                    continue

                discount_percent = self._calculate_discount(current_price, original_price)

                items.append({
                    'source': 'ASOS',
                    'brand': brand_name,
                    'name': product_name,
                    'current_price': current_price,
                    'original_price': original_price,
                    'discount_percent': discount_percent,
                    'category': category_name,
                    'gender': 'Men',
                    'url': url,
                    'scraped_at': datetime.now().isoformat()
                })
            except Exception as e:
                logger.warning(f"Error parsing ASOS product: {e}")
                continue

        return items

    def parse_myer_category(self, html: str, category_name: str) -> List[Dict]:
        """Parse Myer HTML for a single category"""
        items = []
        if not html:
            return items

        soup = BeautifulSoup(html, 'lxml')

        # Myer uses product tiles
        products = soup.find_all('div', class_=lambda x: x and 'product' in str(x).lower() and 'tile' in str(x).lower())
        if not products:
            products = soup.find_all('article', class_=lambda x: x and 'product' in str(x).lower())

        for product in products[:50]:
            try:
                # Find product link
                link = product.find('a', href=True)
                if not link:
                    continue

                url = link.get('href', '')
                if not url.startswith('http'):
                    url = f"{self.myer_url}{url}"

                # Find brand and name
                brand_elem = product.find(class_=lambda x: x and 'brand' in str(x).lower())
                name_elem = product.find(class_=lambda x: x and ('name' in str(x).lower() or 'title' in str(x).lower()))

                brand_name = brand_elem.get_text(strip=True) if brand_elem else 'Unknown'
                product_name = name_elem.get_text(strip=True) if name_elem else link.get_text(strip=True)

                # Find prices
                sale_price_elem = product.find(class_=lambda x: x and ('sale' in str(x).lower() or 'now' in str(x).lower()))
                original_price_elem = product.find(class_=lambda x: x and ('was' in str(x).lower() or 'rrp' in str(x).lower()))

                if not sale_price_elem:
                    # Look for any price element
                    price_elem = product.find(class_=lambda x: x and 'price' in str(x).lower())
                    if price_elem:
                        sale_price_elem = price_elem

                if not sale_price_elem:
                    continue

                current_price = sale_price_elem.get_text(strip=True)
                original_price = original_price_elem.get_text(strip=True) if original_price_elem else "N/A"

                current_price = self._clean_price(current_price)
                original_price = self._clean_price(original_price)

                if not current_price or current_price == "N/A":
                    continue

                discount_percent = self._calculate_discount(current_price, original_price)

                items.append({
                    'source': 'Myer',
                    'brand': brand_name,
                    'name': product_name,
                    'current_price': current_price,
                    'original_price': original_price,
                    'discount_percent': discount_percent,
                    'category': category_name,
                    'gender': 'Men',
                    'url': url,
                    'scraped_at': datetime.now().isoformat()
                })
            except Exception as e:
                logger.warning(f"Error parsing Myer product: {e}")
                continue

        return items

    def parse_jbhifi_category(self, html: str, category_name: str) -> List[Dict]:
        """Parse JB Hi-Fi HTML for a single category"""
        items = []
        if not html:
            return items

        soup = BeautifulSoup(html, 'lxml')

        # JB Hi-Fi uses product tiles/cards
        products = soup.find_all('div', class_=lambda x: x and 'product' in str(x).lower())
        if not products:
            products = soup.find_all('article', class_=lambda x: x and 'product' in str(x).lower())

        for product in products[:50]:
            try:
                # Find product link
                link = product.find('a', href=True)
                if not link:
                    continue

                url = link.get('href', '')
                if not url.startswith('http'):
                    url = f"{self.jbhifi_url}{url}"

                # Find product name/title
                name_elem = product.find('span', class_=lambda x: x and 'title' in str(x).lower())
                if not name_elem:
                    name_elem = product.find('h2') or product.find('h3') or product.find(class_=lambda x: x and 'name' in str(x).lower())

                product_name = name_elem.get_text(strip=True) if name_elem else link.get('title', '') or link.get_text(strip=True)

                if not product_name or len(product_name) < 3:
                    continue

                # Extract brand from product name (usually first word or known brands)
                brand_name = self._extract_jbhifi_brand(product_name)

                # Find prices - JB uses sale-price and was-price classes
                sale_price_elem = product.find(class_=lambda x: x and ('sale' in str(x).lower() or 'current' in str(x).lower() or 'now' in str(x).lower()))
                original_price_elem = product.find(class_=lambda x: x and ('was' in str(x).lower() or 'original' in str(x).lower() or 'rrp' in str(x).lower()))

                if not sale_price_elem:
                    # Try to find any price element
                    price_elem = product.find(class_=lambda x: x and 'price' in str(x).lower())
                    if price_elem:
                        sale_price_elem = price_elem

                if not sale_price_elem:
                    continue

                current_price = sale_price_elem.get_text(strip=True)
                original_price = original_price_elem.get_text(strip=True) if original_price_elem else "N/A"

                current_price = self._clean_price(current_price)
                original_price = self._clean_price(original_price)

                if not current_price or current_price == "N/A":
                    continue

                discount_percent = self._calculate_discount(current_price, original_price)

                # Only include items with actual discounts
                if discount_percent <= 0:
                    continue

                items.append({
                    'source': 'JB Hi-Fi',
                    'brand': brand_name,
                    'name': product_name,
                    'current_price': current_price,
                    'original_price': original_price,
                    'discount_percent': discount_percent,
                    'category': category_name,
                    'gender': 'Unisex',
                    'url': url,
                    'scraped_at': datetime.now().isoformat()
                })
            except Exception as e:
                logger.warning(f"Error parsing JB Hi-Fi product: {e}")
                continue

        return items

    def _extract_jbhifi_brand(self, product_name: str) -> str:
        """Extract brand name from JB Hi-Fi product name"""
        # Common tech brands
        known_brands = [
            'Apple', 'Samsung', 'Sony', 'LG', 'Bose', 'JBL', 'Beats', 'Sennheiser',
            'Microsoft', 'HP', 'Dell', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Razer',
            'Logitech', 'Nintendo', 'PlayStation', 'Xbox', 'Canon', 'Nikon', 'GoPro',
            'Fitbit', 'Garmin', 'Google', 'Amazon', 'Sonos', 'Bang & Olufsen',
            'Marshall', 'Audio-Technica', 'Jabra', 'Skullcandy', 'Panasonic',
            'TCL', 'Hisense', 'Philips', 'Pioneer', 'Denon', 'Yamaha', 'DJI',
            'Fujifilm', 'Olympus', 'SanDisk', 'Western Digital', 'Seagate',
            'Kingston', 'Corsair', 'HyperX', 'SteelSeries', 'Turtle Beach'
        ]

        product_upper = product_name.upper()
        for brand in known_brands:
            if brand.upper() in product_upper:
                return brand

        # Try to extract first word as brand
        words = product_name.split()
        if words:
            return words[0]

        return 'Unknown'

    def parse_davidjones_category(self, html: str, category_name: str) -> List[Dict]:
        """Parse David Jones HTML for a single category"""
        items = []
        if not html:
            return items

        soup = BeautifulSoup(html, 'lxml')

        # David Jones uses ProductCard components with dynamic class names inside <article> elements
        # Find all product cards by looking for articles with class containing 'ProductCard_root'
        products = soup.find_all('article', class_=lambda x: x and 'ProductCard_root' in x)

        for product in products[:60]:
            try:
                # Find product link
                link = product.find('a', href=True)
                if not link:
                    continue

                url = link.get('href', '')
                if not url or not url.startswith('/product/'):
                    continue
                url = f"{self.davidjones_url}{url}"

                # Find brand (in <p> tag with class containing 'ProductCard_brand')
                brand_elem = product.find('p', class_=lambda x: x and 'ProductCard_brand' in x)
                brand_name = brand_elem.get_text(strip=True) if brand_elem else 'Unknown'

                # Find product name (in <h2> tag with class containing 'ProductCard_name')
                name_elem = product.find('h2', class_=lambda x: x and 'ProductCard_name' in x)
                product_name = name_elem.get_text(strip=True) if name_elem else ''

                if not product_name:
                    continue

                # Find sale price (class contains 'Price_salePrice')
                sale_price_elem = product.find(class_=lambda x: x and 'Price_salePrice' in x)
                # Find original/was price (class contains 'Price_inactivePrice')
                original_price_elem = product.find(class_=lambda x: x and 'Price_inactivePrice' in x)

                # If no sale price found, try regular price
                if not sale_price_elem:
                    sale_price_elem = product.find(class_=lambda x: x and 'Price_price' in x and 'inactive' not in x)

                if not sale_price_elem:
                    continue

                current_price = sale_price_elem.get_text(strip=True)
                original_price = original_price_elem.get_text(strip=True) if original_price_elem else "N/A"

                current_price = self._clean_price(current_price)
                original_price = self._clean_price(original_price)

                if not current_price or current_price == "N/A":
                    continue

                discount_percent = self._calculate_discount(current_price, original_price)

                # Only include items with actual discounts
                if discount_percent <= 0:
                    continue

                items.append({
                    'source': 'David Jones',
                    'brand': brand_name,
                    'name': product_name,
                    'current_price': current_price,
                    'original_price': original_price,
                    'discount_percent': discount_percent,
                    'category': category_name,
                    'gender': 'Men',
                    'url': url,
                    'scraped_at': datetime.now().isoformat()
                })
            except Exception as e:
                logger.warning(f"Error parsing David Jones product: {e}")
                continue

        return items

    def _clean_price(self, price_str: str) -> str:
        """Extract and clean price from string"""
        if not price_str:
            return "N/A"
        # Find price pattern
        match = re.search(r'\$[\d,]+\.?\d*', price_str)
        if match:
            return match.group()
        return "N/A"

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

    def _extract_url(self, product, base_url: str) -> str:
        """Extract product URL - looks for first valid product link"""
        # Find all links and get the first one with an actual path (not just #)
        links = product.find_all('a', href=True)
        for link in links:
            url = link.get('href', '')
            if url and url != '#' and not url.startswith('#'):
                if url.startswith('http'):
                    return url
                return f"{base_url}{url}"
        return ""

    async def scrape_all(self, stores: List[str] = None) -> List[Dict]:
        """Scrape all sources in parallel

        Args:
            stores: List of stores to scrape. Options: 'iconic', 'asos', 'myer', 'jbhifi', 'davidjones'
                    If None, uses ENABLED_STORES configuration.
        """
        if stores is None:
            stores = ENABLED_STORES

        all_items = []
        start_time = datetime.now()

        # Create connector with connection pooling
        connector = aiohttp.TCPConnector(limit=30, limit_per_host=10)

        async with aiohttp.ClientSession(connector=connector) as session:
            # Build list of all tasks with metadata
            tasks = []  # List of (store, category_name, fetch_coroutine)

            # The Iconic tasks
            if 'iconic' in stores:
                for category_name, category_path in self.iconic_categories.items():
                    url = f"{self.iconic_url}/{category_path}"
                    tasks.append(('iconic', category_name, self.fetch_page(session, url, self.iconic_url)))

            # ASOS tasks
            if 'asos' in stores:
                for category_name, category_path in self.asos_categories.items():
                    url = f"{self.asos_url}/{category_path}"
                    tasks.append(('asos', category_name, self.fetch_page(session, url, self.asos_url)))

            # Myer tasks
            if 'myer' in stores:
                for category_name, category_path in self.myer_categories.items():
                    # Myer uses filter for sale items
                    url = f"{self.myer_url}/{category_path}?sortBy=OnSale"
                    tasks.append(('myer', category_name, self.fetch_page(session, url, self.myer_url)))

            # JB Hi-Fi tasks
            if 'jbhifi' in stores:
                for category_name, category_path in self.jbhifi_categories.items():
                    url = f"{self.jbhifi_url}/{category_path}"
                    tasks.append(('jbhifi', category_name, self.fetch_page(session, url, self.jbhifi_url)))

            # David Jones tasks
            if 'davidjones' in stores:
                for category_name, category_path in self.davidjones_categories.items():
                    url = f"{self.davidjones_url}/{category_path}"
                    tasks.append(('davidjones', category_name, self.fetch_page(session, url, self.davidjones_url)))

            # Execute all requests in parallel
            logger.info(f"Fetching {len(tasks)} pages from {len(stores)} stores in parallel...")

            # Gather all results
            task_results = await asyncio.gather(*[t[2] for t in tasks], return_exceptions=True)

            fetch_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"All pages fetched in {fetch_time:.2f}s")

            # Track counts per store
            store_counts = {}

            # Process results
            for i, (store, category_name, _) in enumerate(tasks):
                html = task_results[i]
                if isinstance(html, Exception):
                    logger.error(f"Error fetching {store}/{category_name}: {html}")
                    continue

                # Parse based on store
                if store == 'iconic':
                    items = self.parse_iconic_category(html, category_name)
                elif store == 'asos':
                    items = self.parse_asos_category(html, category_name)
                elif store == 'myer':
                    items = self.parse_myer_category(html, category_name)
                elif store == 'jbhifi':
                    items = self.parse_jbhifi_category(html, category_name)
                elif store == 'davidjones':
                    items = self.parse_davidjones_category(html, category_name)
                else:
                    items = []

                if items:
                    logger.info(f"{store}/{category_name}: {len(items)} items")
                    store_counts[store] = store_counts.get(store, 0) + len(items)

                all_items.extend(items)

            # Log per-store totals
            for store, count in store_counts.items():
                logger.info(f"Total from {store}: {count} items")

        # Sort by discount percentage (highest first)
        all_items.sort(key=lambda x: x.get('discount_percent', 0), reverse=True)

        total_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Total scraping complete: {len(all_items)} items in {total_time:.2f}s")

        return all_items


def scrape_all_sync() -> List[Dict]:
    """Synchronous wrapper for async scraping - use this from sync code"""
    scraper = AsyncDiscountScraper()
    return asyncio.run(scraper.scrape_all())


if __name__ == "__main__":
    items = scrape_all_sync()
    print(f"\nFound {len(items)} discounted items:")
    print(json.dumps(items[:5], indent=2))
