// Discount Finder - Professional UI
// For production, update to your Vercel URL: https://YOUR_PROJECT_NAME.vercel.app/api/scrape
const API_URL = 'http://localhost:8080/api/scrape';

let cachedItems = [];
let filteredItems = [];
let lastScrapedTime = null;
let favoriteBrands = [];

// Brand tier categorization
const BRAND_TIERS = {
    luxury: [
        'Gucci', 'Prada', 'Burberry', 'Versace', 'Balenciaga', 'Saint Laurent',
        'Givenchy', 'Valentino', 'Dolce & Gabbana', 'Fendi', 'Bottega Veneta',
        'Tom Ford', 'Alexander McQueen', 'Off-White', 'Balmain', 'Kenzo',
        'Salvatore Ferragamo', 'Ermenegildo Zegna', 'Brunello Cucinelli'
    ],
    premium: [
        'Hugo Boss', 'BOSS', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren',
        'Polo Ralph Lauren', 'Lacoste', 'Ted Baker', 'Paul Smith', 'Theory',
        'Reiss', 'AllSaints', 'Sandro', 'The Kooples', 'Armani Exchange',
        'Michael Kors', 'Coach', 'Kate Spade', 'Marc Jacobs', 'Diesel',
        'Fred Perry', 'Gant', 'Barbour', 'Hackett', 'Scotch & Soda',
        'J.Lindeberg', 'Tiger of Sweden', 'Filippa K', 'Acne Studios',
        'R.M. Williams', 'Country Road', 'Trenery', 'Witchery', 'Saba',
        'MJ Bale', 'Oxford', 'Calibre', 'Aquila', 'Julius Marlow',
        'Rodd & Gunn', 'Gazman', 'Ben Sherman', 'Original Penguin'
    ],
    midrange: [
        'Levi\'s', 'Levis', 'Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok',
        'Under Armour', 'The North Face', 'Columbia', 'Patagonia', 'Timberland',
        'Converse', 'Vans', 'ASICS', 'Skechers', 'Clarks', 'Hush Puppies',
        'Wrangler', 'Lee', 'Dickies', 'Carhartt', 'Champion', 'Fila',
        'Guess', 'Nautica', 'Dockers', 'Hanes', 'Fruit of the Loom',
        'Jack & Jones', 'Only & Sons', 'Selected Homme', 'Blend',
        'Superdry', 'Billabong', 'Quiksilver', 'Rip Curl', 'Volcom',
        'ASOS DESIGN', 'Topman', 'River Island', 'Burton', 'New Look',
        'Staple Superior', 'Academy Brand', 'Industrie', 'Kenji', 'JD Sports'
    ],
    budget: [
        'Bonds', 'Cotton On', 'H&M', 'Uniqlo', 'Zara', 'Pull & Bear',
        'Bershka', 'Stradivarius', 'Mango', 'Primark', 'Kmart', 'Target',
        'Best & Less', 'Big W', 'Lowes', 'Rivers', 'Jeanswest',
        'Jay Jays', 'Factorie', 'Typo', 'Supre', 'Valleygirl',
        'Unknown'
    ]
};

// Get brand tier
function getBrandTier(brand) {
    if (!brand) return 'unknown';
    const brandLower = brand.toLowerCase();

    for (const [tier, brands] of Object.entries(BRAND_TIERS)) {
        if (brands.some(b => brandLower.includes(b.toLowerCase()) || b.toLowerCase().includes(brandLower))) {
            return tier;
        }
    }
    return 'unknown';
}

// Get tier display name
function getTierDisplayName(tier) {
    const names = {
        luxury: 'Luxury',
        premium: 'Premium',
        midrange: 'Mid-Range',
        budget: 'Budget',
        unknown: 'Other'
    };
    return names[tier] || 'Other';
}

// Category average prices (calculated dynamically)
let categoryAverages = {};

function calculateCategoryAverages(items) {
    const categoryPrices = {};
    items.forEach(item => {
        const cat = item.category || 'Other';
        const price = parsePrice(item.current_price);
        if (price > 0) {
            if (!categoryPrices[cat]) categoryPrices[cat] = [];
            categoryPrices[cat].push(price);
        }
    });

    categoryAverages = {};
    for (const [cat, prices] of Object.entries(categoryPrices)) {
        categoryAverages[cat] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }
}

// Deal Quality Score (0-100)
function calculateDealScore(item) {
    let score = 0;

    // 1. Discount percentage (40% weight, max 40 points)
    const discountPct = parseFloat(item.discount_percent) || 0;
    const discountScore = Math.min(40, (discountPct / 70) * 40);
    score += discountScore;

    // 2. Brand tier bonus (25% weight, max 25 points)
    const tier = getBrandTier(item.brand);
    const tierScores = {
        luxury: 25,
        premium: 22,
        midrange: 15,
        budget: 8,
        unknown: 12
    };
    score += tierScores[tier] || 12;

    // 3. Price vs category average (20% weight, max 20 points)
    const currentPrice = parsePrice(item.current_price);
    const categoryAvg = categoryAverages[item.category] || currentPrice;
    if (categoryAvg > 0 && currentPrice > 0) {
        const pctBelowAvg = ((categoryAvg - currentPrice) / categoryAvg) * 100;
        const avgScore = Math.max(0, Math.min(20, 10 + (pctBelowAvg / 5)));
        score += avgScore;
    } else {
        score += 10;
    }

    // 4. Absolute savings (15% weight, max 15 points)
    const originalPrice = parsePrice(item.original_price);
    const savings = originalPrice - currentPrice;
    const savingsScore = Math.min(15, (savings / 300) * 15);
    score += Math.max(0, savingsScore);

    return Math.round(score);
}

// Get score label
function getScoreLabel(score) {
    if (score >= 90) return 'Exceptional';
    if (score >= 75) return 'Great Deal';
    if (score >= 60) return 'Good Deal';
    if (score >= 40) return 'Fair';
    return 'Meh';
}

// Get score class for styling
function getScoreClass(score) {
    if (score >= 90) return 'score-exceptional';
    if (score >= 75) return 'score-great';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-meh';
}

// Favorite Brands Management
function loadFavoriteBrands() {
    try {
        const saved = localStorage.getItem('discountFinder_favoriteBrands');
        if (saved) {
            favoriteBrands = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not load favorite brands');
    }
}

function saveFavoriteBrands() {
    try {
        localStorage.setItem('discountFinder_favoriteBrands', JSON.stringify(favoriteBrands));
    } catch (e) {
        console.warn('Could not save favorite brands');
    }
}

function toggleFavoriteBrand(brand) {
    const index = favoriteBrands.indexOf(brand);
    if (index === -1) {
        favoriteBrands.push(brand);
    } else {
        favoriteBrands.splice(index, 1);
    }
    saveFavoriteBrands();
    updateFavoriteBrandsUI();
    filterAndDisplay();
}

function isFavoriteBrand(brand) {
    return favoriteBrands.includes(brand);
}

function updateFavoriteBrandsUI() {
    const container = document.getElementById('favoriteBrandsList');
    if (!container) return;

    if (favoriteBrands.length === 0) {
        container.innerHTML = '<span class="no-favorites">No favorite brands yet. Click the heart on any brand to add it.</span>';
        return;
    }

    container.innerHTML = favoriteBrands.map(brand => `
        <span class="favorite-brand-tag">
            ${escapeHtml(brand)}
            <button class="remove-favorite" onclick="toggleFavoriteBrand('${escapeHtml(brand)}')" title="Remove from favorites">&times;</button>
        </span>
    `).join('');
}

function showFavoritesOnly() {
    document.getElementById('showFavoritesOnly').checked = true;
    currentPage = 1;
    filterAndDisplay();
}

// Pagination
const ITEMS_PER_PAGE = 48;
let currentPage = 1;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFavoriteBrands();
    updateFavoriteBrandsUI();
    loadCachedData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('source').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('category').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('brand').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('brandTier').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('minDiscount').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('sortBy').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });
    document.getElementById('showFavoritesOnly').addEventListener('change', () => { currentPage = 1; filterAndDisplay(); });

    // Search with debounce
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            filterAndDisplay();
        }, 300);
    });

    // Price range with debounce
    let priceTimeout;
    const priceHandler = () => {
        clearTimeout(priceTimeout);
        priceTimeout = setTimeout(() => {
            currentPage = 1;
            filterAndDisplay();
        }, 300);
    };
    document.getElementById('minPrice').addEventListener('input', priceHandler);
    document.getElementById('maxPrice').addEventListener('input', priceHandler);
}

// Show loading skeletons
function showLoadingState() {
    const container = document.getElementById('itemsContainer');
    const skeletons = Array(8).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton skeleton-source"></div>
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-subtitle"></div>
            </div>
            <div class="skeleton-pricing">
                <div class="skeleton skeleton-price"></div>
                <div class="skeleton skeleton-badge"></div>
            </div>
            <div class="skeleton-footer">
                <div class="skeleton skeleton-btn"></div>
            </div>
        </div>
    `).join('');
    container.innerHTML = skeletons;
    document.getElementById('pagination').style.display = 'none';
}

// Scrape deals from backend API
async function scrapeDeals() {
    const btn = document.getElementById('scrapeBtn');
    const statusEl = document.getElementById('statusText');
    const cacheInfoEl = document.getElementById('cacheInfo');

    btn.disabled = true;
    btn.classList.add('loading');
    statusEl.textContent = 'Fetching deals...';
    cacheInfoEl.textContent = '';
    showLoadingState();

    try {
        const startTime = Date.now();
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (data.success && data.items) {
            cachedItems = data.items;
            lastScrapedTime = data.timestamp || new Date().toISOString();
            saveCachedData();
            calculateCategoryAverages(cachedItems);
            updateDropdowns();
            currentPage = 1;
            filterAndDisplay();

            if (data.cached) {
                statusEl.textContent = `Loaded ${data.total} items (cached)`;
                cacheInfoEl.textContent = `${elapsed}s`;
            } else {
                statusEl.textContent = `Loaded ${data.total} items`;
                cacheInfoEl.textContent = `Scraped in ${data.scrape_time_seconds || elapsed}s`;
            }
        } else {
            throw new Error(data.error || 'Invalid response');
        }

    } catch (error) {
        console.error('Scraping error:', error);
        statusEl.textContent = 'Error: ' + error.message;

        document.getElementById('itemsContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color: #ef4444;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3>Failed to load deals</h3>
                <p>${escapeHtml(error.message)}</p>
                <p style="margin-top: 12px; font-size: 12px; color: #94a3b8;">Make sure to update API_URL in docs/js/app.js</p>
            </div>
        `;
        document.getElementById('pagination').style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

// Filter and display items
function filterAndDisplay() {
    const category = document.getElementById('category').value;
    const source = document.getElementById('source').value;
    const brand = document.getElementById('brand').value;
    const brandTier = document.getElementById('brandTier').value;
    const minDiscount = parseFloat(document.getElementById('minDiscount').value) || 0;
    const sortBy = document.getElementById('sortBy').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
    const showFavoritesOnly = document.getElementById('showFavoritesOnly').checked;

    let filtered = [...cachedItems];

    // Apply favorites filter first
    if (showFavoritesOnly && favoriteBrands.length > 0) {
        filtered = filtered.filter(item => favoriteBrands.includes(item.brand));
    }

    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(item =>
            (item.brand && item.brand.toLowerCase().includes(searchQuery)) ||
            (item.name && item.name.toLowerCase().includes(searchQuery))
        );
    }

    // Apply filters
    if (category !== 'all') {
        filtered = filtered.filter(item =>
            item.category && item.category.toLowerCase().includes(category.toLowerCase())
        );
    }

    if (source !== 'all') {
        filtered = filtered.filter(item => item.source === source);
    }

    if (brand !== 'all') {
        filtered = filtered.filter(item => item.brand === brand);
    }

    if (brandTier !== 'all') {
        filtered = filtered.filter(item => getBrandTier(item.brand) === brandTier);
    }

    if (minDiscount > 0) {
        filtered = filtered.filter(item =>
            parseFloat(item.discount_percent || 0) >= minDiscount
        );
    }

    // Apply price range filter
    if (minPrice > 0 || maxPrice < Infinity) {
        filtered = filtered.filter(item => {
            const price = parsePrice(item.current_price);
            return price >= minPrice && price <= maxPrice;
        });
    }

    // Apply sorting
    switch (sortBy) {
        case 'score':
            filtered.sort((a, b) => calculateDealScore(b) - calculateDealScore(a));
            break;
        case 'discount':
            filtered.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
            break;
        case 'savings':
            filtered.sort((a, b) => {
                const savingsA = parsePrice(a.original_price) - parsePrice(a.current_price);
                const savingsB = parsePrice(b.original_price) - parsePrice(b.current_price);
                return savingsB - savingsA;
            });
            break;
        case 'price_low':
            filtered.sort((a, b) => parsePrice(a.current_price) - parsePrice(b.current_price));
            break;
        case 'price_high':
            filtered.sort((a, b) => parsePrice(b.current_price) - parsePrice(a.current_price));
            break;
    }

    filteredItems = filtered;
    displayPage();
    updateStats(filtered);
    updateDashboard(filtered);
}

// Display current page of items
function displayPage() {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredItems.slice(start, end);

    displayItems(pageItems);
    updatePagination(totalPages);
}

// Change page
function changePage(delta) {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
    displayPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update pagination UI
function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// Parse price string to number
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
}

// Get discount badge class
function getDiscountClass(percent) {
    if (percent >= 40) return 'high';
    if (percent >= 20) return 'medium';
    return 'low';
}

// Get source badge class
function getSourceClass(source) {
    if (source === 'The Iconic') return 'iconic';
    if (source === 'ASOS') return 'asos';
    if (source === 'Myer') return 'myer';
    if (source === 'JB Hi-Fi') return 'jbhifi';
    if (source === 'David Jones') return 'davidjones';
    return '';
}

// Display items as cards
function displayItems(items) {
    const container = document.getElementById('itemsContainer');

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </div>
                <h3>No deals found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, index) => {
        const dealScore = calculateDealScore(item);
        const scoreLabel = getScoreLabel(dealScore);
        const scoreClass = getScoreClass(dealScore);
        const isFavorite = item.brand && isFavoriteBrand(item.brand);
        const escapedBrand = item.brand ? item.brand.replace(/'/g, "\\'") : '';
        const savings = parsePrice(item.original_price) - parsePrice(item.current_price);
        const savingsDisplay = savings > 0 ? `$${Math.round(savings)}` : '';

        return `
        <div class="item-card" style="animation-delay: ${Math.min(index * 20, 200)}ms">
            <div class="item-header">
                <div class="item-meta">
                    <span class="item-source ${getSourceClass(item.source)}">${escapeHtml(item.source)}</span>
                    ${item.brand && item.brand !== 'Unknown' ? `
                        <span class="item-brand">
                            ${escapeHtml(item.brand)}
                            <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" onclick="toggleFavoriteBrand('${escapedBrand}')" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                            </button>
                        </span>
                    ` : ''}
                    <span class="brand-tier tier-${getBrandTier(item.brand)}">${getTierDisplayName(getBrandTier(item.brand))}</span>
                </div>
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-category">${escapeHtml(item.category || 'Uncategorized')}</div>
            </div>
            <div class="item-pricing">
                <div class="price-row">
                    <div class="price-main">
                        <span class="current-price">${escapeHtml(item.current_price)}</span>
                        <div class="price-line">
                            ${item.original_price && item.original_price !== 'N/A' ? `<span class="original-price">${escapeHtml(item.original_price)}</span>` : ''}
                            ${savingsDisplay ? `<span class="savings-badge">-${savingsDisplay}</span>` : ''}
                        </div>
                    </div>
                    <div class="deal-score-badge ${scoreClass}">
                        <span class="score-value">${dealScore}</span>
                    </div>
                </div>
                ${item.discount_percent > 0 ? `<span class="discount-badge ${getDiscountClass(item.discount_percent)}">${item.discount_percent}% off</span>` : ''}
            </div>
            <div class="item-footer">
                ${item.url && !item.url.endsWith('#') ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn-view">View Deal</a>` : '<button class="btn-view" disabled>No Link</button>'}
            </div>
        </div>
    `}).join('');
}

// Update header stats
function updateStats(items) {
    document.getElementById('totalItems').textContent = items.length;

    if (items.length > 0) {
        const avgDiscount = items.reduce((sum, item) => sum + (item.discount_percent || 0), 0) / items.length;
        document.getElementById('avgDiscount').textContent = Math.round(avgDiscount) + '%';
    } else {
        document.getElementById('avgDiscount').textContent = '0%';
    }
}

// Update all dropdowns
function updateDropdowns() {
    updateCategories();
    updateBrands();
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

// Update brands dropdown
function updateBrands() {
    const brands = new Set();
    cachedItems.forEach(item => {
        if (item.brand && item.brand !== 'Unknown') brands.add(item.brand);
    });

    const select = document.getElementById('brand');
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Brands</option>';

    Array.from(brands).sort().forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        select.appendChild(option);
    });

    select.value = currentValue;
}

// Save to browser storage
function saveCachedData() {
    try {
        localStorage.setItem('discountFinder_items', JSON.stringify(cachedItems));
        localStorage.setItem('discountFinder_timestamp', lastScrapedTime);
    } catch (e) {
        console.warn('Could not save to localStorage');
    }
}

// Load from browser storage
function loadCachedData() {
    try {
        const items = localStorage.getItem('discountFinder_items');
        const timestamp = localStorage.getItem('discountFinder_timestamp');

        if (items) {
            cachedItems = JSON.parse(items);
            lastScrapedTime = timestamp;
            calculateCategoryAverages(cachedItems);
            updateDropdowns();
            filterAndDisplay();

            const statusEl = document.getElementById('statusText');
            if (lastScrapedTime) {
                const date = new Date(lastScrapedTime);
                statusEl.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
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
    document.getElementById('brand').value = 'all';
    document.getElementById('brandTier').value = 'all';
    document.getElementById('minDiscount').value = '0';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('sortBy').value = 'score';
    document.getElementById('searchInput').value = '';
    document.getElementById('showFavoritesOnly').checked = false;
    currentPage = 1;
    filterAndDisplay();
}

// ============ STATS DASHBOARD ============

let chartInstances = {};
let dashboardVisible = true;

function toggleDashboard() {
    const content = document.getElementById('dashboardContent');
    const toggleText = document.getElementById('dashboardToggleText');
    dashboardVisible = !dashboardVisible;

    if (dashboardVisible) {
        content.style.display = 'block';
        toggleText.textContent = 'Hide';
        updateDashboard(filteredItems);
    } else {
        content.style.display = 'none';
        toggleText.textContent = 'Show';
    }
}

function updateDashboard(items) {
    if (!dashboardVisible || items.length === 0) return;

    updateSummaryStats(items);
    updateCategoryChart(items);
    updateTierChart(items);
    updatePriceChart(items);
    updateScoreChart(items);
}

function updateSummaryStats(items) {
    // Total potential savings
    const totalSavings = items.reduce((sum, item) => {
        const original = parsePrice(item.original_price);
        const current = parsePrice(item.current_price);
        return sum + Math.max(0, original - current);
    }, 0);
    document.getElementById('totalSavings').textContent = '$' + Math.round(totalSavings).toLocaleString();

    // Best deal score
    const bestScore = Math.max(...items.map(item => calculateDealScore(item)));
    document.getElementById('bestDealScore').textContent = bestScore;

    // Average price
    const avgPrice = items.reduce((sum, item) => sum + parsePrice(item.current_price), 0) / items.length;
    document.getElementById('avgPrice').textContent = '$' + Math.round(avgPrice);

    // Top brand by deal count
    const brandCounts = {};
    items.forEach(item => {
        if (item.brand && item.brand !== 'Unknown') {
            brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
        }
    });
    const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topBrand').textContent = topBrand ? topBrand[0] : '-';
}

function updateCategoryChart(items) {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    // Count items per category
    const categoryCounts = {};
    items.forEach(item => {
        const cat = item.category || 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Sort by count and take top 8
    const sorted = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = sorted.map(([cat]) => cat);
    const data = sorted.map(([, count]) => count);

    if (chartInstances.category) {
        chartInstances.category.destroy();
    }

    chartInstances.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
                    '#ec4899', '#f43f5e', '#f97316', '#eab308'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function updateTierChart(items) {
    const ctx = document.getElementById('tierChart').getContext('2d');

    // Count items per tier
    const tierCounts = { luxury: 0, premium: 0, midrange: 0, budget: 0, unknown: 0 };
    items.forEach(item => {
        const tier = getBrandTier(item.brand);
        tierCounts[tier]++;
    });

    const labels = ['Luxury', 'Premium', 'Mid-Range', 'Budget', 'Other'];
    const data = [tierCounts.luxury, tierCounts.premium, tierCounts.midrange, tierCounts.budget, tierCounts.unknown];
    const colors = ['#fbbf24', '#3b82f6', '#22c55e', '#94a3b8', '#e2e8f0'];

    if (chartInstances.tier) {
        chartInstances.tier.destroy();
    }

    chartInstances.tier = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updatePriceChart(items) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    // Create price buckets
    const buckets = {
        '$0-25': 0,
        '$25-50': 0,
        '$50-100': 0,
        '$100-200': 0,
        '$200-500': 0,
        '$500+': 0
    };

    items.forEach(item => {
        const price = parsePrice(item.current_price);
        if (price <= 25) buckets['$0-25']++;
        else if (price <= 50) buckets['$25-50']++;
        else if (price <= 100) buckets['$50-100']++;
        else if (price <= 200) buckets['$100-200']++;
        else if (price <= 500) buckets['$200-500']++;
        else buckets['$500+']++;
    });

    if (chartInstances.price) {
        chartInstances.price.destroy();
    }

    chartInstances.price = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(buckets),
            datasets: [{
                data: Object.values(buckets),
                backgroundColor: '#6366f1',
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updateScoreChart(items) {
    const ctx = document.getElementById('scoreChart').getContext('2d');

    // Create score buckets
    const buckets = {
        'Meh (0-39)': 0,
        'Fair (40-59)': 0,
        'Good (60-74)': 0,
        'Great (75-89)': 0,
        'Exceptional (90+)': 0
    };

    items.forEach(item => {
        const score = calculateDealScore(item);
        if (score < 40) buckets['Meh (0-39)']++;
        else if (score < 60) buckets['Fair (40-59)']++;
        else if (score < 75) buckets['Good (60-74)']++;
        else if (score < 90) buckets['Great (75-89)']++;
        else buckets['Exceptional (90+)']++;
    });

    const colors = ['#94a3b8', '#e2e8f0', '#3b82f6', '#22c55e', '#fbbf24'];

    if (chartInstances.score) {
        chartInstances.score.destroy();
    }

    chartInstances.score = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(buckets),
            datasets: [{
                data: Object.values(buckets),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}
