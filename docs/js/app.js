// Discount Scraper - GitHub Pages Version
// Replace API_URL with your actual Vercel backend URL

// TODO: Update this with your Vercel deployment URL
const API_URL = 'https://YOUR_PROJECT_NAME.vercel.app/api/scrape';

let cachedItems = [];
let lastScrapedTime = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Discount Scraper loaded');
    console.log('API URL:', API_URL);
    loadCachedData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('source').addEventListener('change', filterAndDisplay);
    document.getElementById('category').addEventListener('change', filterAndDisplay);
    document.getElementById('minDiscount').addEventListener('change', filterAndDisplay);
}

// Scrape deals from backend API
async function scrapeDeals() {
    const btn = document.getElementById('scrapeBtn');
    const statusEl = document.getElementById('statusText');

    btn.disabled = true;
    statusEl.innerHTML = '🔄 Scraping deals...';

    try {
        console.log('Calling API:', API_URL);
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.items) {
            cachedItems = data.items;
            lastScrapedTime = data.timestamp || new Date().toISOString();
            saveCachedData();
            updateCategories();
            filterAndDisplay();
            statusEl.textContent = '✅ Updated: ' + new Date(lastScrapedTime).toLocaleTimeString();
            console.log(`Found ${cachedItems.length} deals`);
        } else {
            throw new Error('Invalid response');
        }

    } catch (error) {
        console.error('Scraping error:', error);
        statusEl.textContent = '❌ Error: ' + error.message;
        alert('API Error: ' + error.message + '\n\nMake sure to update the API_URL in docs/js/app.js');
    } finally {
        btn.disabled = false;
    }
}

// Filter and display items
function filterAndDisplay() {
    const category = document.getElementById('category').value;
    const source = document.getElementById('source').value;
    const minDiscount = parseFloat(document.getElementById('minDiscount').value) || 0;

    let filtered = cachedItems;

    if (category !== 'all') {
        filtered = filtered.filter(item =>
            item.category && item.category.toLowerCase().includes(category.toLowerCase())
        );
    }

    if (source !== 'all') {
        filtered = filtered.filter(item => item.source === source);
    }

    if (minDiscount > 0) {
        filtered = filtered.filter(item =>
            parseFloat(item.discount_percent || 0) >= minDiscount
        );
    }

    displayItems(filtered);
    updateStatus(filtered);
}

// Display items as cards
function displayItems(items) {
    const container = document.getElementById('itemsContainer');

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <h2>No deals found</h2>
                <p>Try adjusting your filters or scrape fresh data</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="item-card">
            <div class="item-header">
                <span class="item-source">${escapeHtml(item.source)}</span>
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-category">${escapeHtml(item.category || 'N/A')}</div>
            </div>
            <div class="item-pricing">
                <div class="price-row">
                    <span class="price-label">Price</span>
                    <span class="current-price">${escapeHtml(item.current_price)}</span>
                </div>
                <div class="price-row">
                    <span class="price-label">Was</span>
                    <span class="original-price">${escapeHtml(item.original_price)}</span>
                </div>
                <div class="price-row">
                    <span class="price-label">Discount</span>
                    <span class="discount-badge">${item.discount_percent}% OFF</span>
                </div>
            </div>
            <div class="item-footer">
                ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="btn-view">View Deal →</a>` : '<button class="btn-view" disabled>No Link</button>'}
            </div>
        </div>
    `).join('');
}

// Update status display
function updateStatus(items) {
    document.getElementById('scrapeCount').textContent = `${items.length} items found`;
}

// Update categories dropdown
function updateCategories() {
    const categories = new Set();
    cachedItems.forEach(item => {
        if (item.category) categories.add(item.category);
    });

    const select = document.getElementById('category');
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Categories</option>';

    Array.from(categories).sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });

    select.value = currentValue;
}

// Save to browser storage
function saveCachedData() {
    try {
        localStorage.setItem('discountScraper_items', JSON.stringify(cachedItems));
        localStorage.setItem('discountScraper_timestamp', lastScrapedTime);
    } catch (e) {
        console.warn('Could not save to localStorage');
    }
}

// Load from browser storage
function loadCachedData() {
    try {
        const items = localStorage.getItem('discountScraper_items');
        const timestamp = localStorage.getItem('discountScraper_timestamp');

        if (items) {
            cachedItems = JSON.parse(items);
            lastScrapedTime = timestamp;
            updateCategories();
            filterAndDisplay();

            const statusEl = document.getElementById('statusText');
            if (lastScrapedTime) {
                statusEl.textContent = '✅ Last: ' + new Date(lastScrapedTime).toLocaleTimeString();
            }
        }
    } catch (e) {
        console.warn('Could not load from localStorage');
    }
}

// Escape HTML for security
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Reset all filters
function resetFilters() {
    document.getElementById('source').value = 'all';
    document.getElementById('category').value = 'all';
    document.getElementById('minDiscount').value = '0';
    filterAndDisplay();
}
