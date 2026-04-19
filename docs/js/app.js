// Discount Finder - Professional UI
// Auto-detect: use relative URL for production, localhost for dev
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api/scrape'
    : '/api/scrape';

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
        'Polo Ralph Lauren', 'Lacoste', 'Ted Baker', 'Paul Smith',
        'Reiss', 'Sandro', 'The Kooples', 'Armani Exchange',
        'Michael Kors', 'Coach', 'Kate Spade', 'Marc Jacobs', 'Diesel',
        'Fred Perry', 'Gant', 'Barbour', 'Hackett', 'Scotch & Soda',
        'J.Lindeberg', 'Tiger of Sweden', 'Filippa K', 'Acne Studios',
        'R.M. Williams', 'Country Road', 'Trenery', 'Saba',
        'MJ Bale', 'Oxford', 'Calibre', 'Aquila',
        'Rodd & Gunn', 'Ben Sherman', 'Original Penguin',
        'The North Face', 'Columbia', 'Patagonia', 'Superdry', 'Uniqlo', 'Zara'
    ],
    midrange: [
        'Levi\'s', 'Levis', 'Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok',
        'Under Armour', 'Timberland', 'Converse', 'Vans', 'ASICS', 'Skechers',
        'Clarks', 'Hush Puppies', 'Wrangler', 'Lee', 'Dickies', 'Carhartt',
        'Champion', 'Fila', 'Guess', 'Nautica', 'Dockers', 'Hanes',
        'Jack & Jones', 'Only & Sons', 'Selected Homme', 'Blend',
        'Billabong', 'Quiksilver', 'Rip Curl', 'Volcom',
        'ASOS DESIGN', 'Topman', 'River Island', 'Burton', 'New Look',
        'Staple Superior', 'Academy Brand', 'Industrie', 'Kenji', 'JD Sports',
        'Theory', 'AllSaints', 'Witchery', 'Julius Marlow', 'Gazman', 'Mango'
    ],
    budget: [
        'Bonds', 'Cotton On', 'H&M', 'Pull & Bear',
        'Bershka', 'Stradivarius', 'Primark', 'Kmart', 'Target',
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
        container.innerHTML = '<span class="fav-empty">No favorites yet — heart a brand below</span>';
        return;
    }

    container.innerHTML = favoriteBrands.map(brand => `
        <span class="fav-tag">
            ${escapeHtml(brand)}
            <button class="fav-tag-remove" onclick="toggleFavoriteBrand('${escapeHtml(brand)}')" title="Remove">&times;</button>
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

// ============ PERSISTENT FILTERS ============

const FILTER_STORAGE_KEY = 'discountFinder_filters';

const FILTER_DEFAULTS = {
    source: 'all',
    category: 'all',
    brandTier: 'premium',
    minDiscount: '30',
    minPrice: '',
    maxPrice: '',
    sortBy: 'score',
    showFavoritesOnly: false,
};

function saveFilterState() {
    try {
        const state = {
            source: 'all', // never persist store filter — scrape always fetches all
            category: document.getElementById('category').value,
            brandTier: document.getElementById('brandTier').value,
            minDiscount: document.getElementById('minDiscount').value,
            minPrice: document.getElementById('minPrice').value,
            maxPrice: document.getElementById('maxPrice').value,
            sortBy: document.getElementById('sortBy').value,
            showFavoritesOnly: document.getElementById('showFavoritesOnly').checked,
        };
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save filter state');
    }
}

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        return raw ? { ...FILTER_DEFAULTS, ...JSON.parse(raw) } : FILTER_DEFAULTS;
    } catch (e) {
        return FILTER_DEFAULTS;
    }
}

function applyFilterState(state) {
    document.getElementById('source').value = state.source;
    document.getElementById('brandTier').value = state.brandTier;
    document.getElementById('minDiscount').value = state.minDiscount;
    document.getElementById('minPrice').value = state.minPrice;
    document.getElementById('maxPrice').value = state.maxPrice;
    document.getElementById('sortBy').value = state.sortBy;
    document.getElementById('showFavoritesOnly').checked = state.showFavoritesOnly;
    // category is populated dynamically — defer to after items load
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFavoriteBrands();
    updateFavoriteBrandsUI();
    loadBrandFilterState();
    applyFilterState(loadFilterState());
    loadCachedData();
    setupEventListeners();
});

function setupEventListeners() {
    const saveAndFilter = () => { currentPage = 1; saveFilterState(); filterAndDisplay(); };

    document.getElementById('source').addEventListener('change', saveAndFilter);
    document.getElementById('category').addEventListener('change', saveAndFilter);
    document.getElementById('brandTier').addEventListener('change', saveAndFilter);
    document.getElementById('minDiscount').addEventListener('change', saveAndFilter);
    document.getElementById('sortBy').addEventListener('change', saveAndFilter);
    document.getElementById('showFavoritesOnly').addEventListener('change', saveAndFilter);

    // Search with debounce + clear button visibility
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const clearBtn = document.getElementById('searchClear');
        if (clearBtn) clearBtn.classList.toggle('visible', e.target.value.length > 0);
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
            saveFilterState();
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

// Read current scrape config selections
function getScrapeConfig() {
    const categories = Array.from(
        document.querySelectorAll('#configCategories input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const stores = Array.from(
        document.querySelectorAll('#configStores input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    return { categories, stores };
}

// Scrape deals from backend API
function setStatusDot(state) {
    const dot = document.getElementById('statusDot');
    if (!dot) return;
    dot.className = 'status-dot' + (state ? ' ' + state : '');
}

async function scrapeDeals() {
    const btn = document.getElementById('scrapeBtn');
    const statusEl = document.getElementById('statusText');
    const cacheInfoEl = document.getElementById('cacheInfo');

    btn.disabled = true;
    btn.classList.add('loading');
    statusEl.textContent = 'Fetching deals...';
    cacheInfoEl.textContent = '';
    setStatusDot('loading');
    showLoadingState();

    try {
        const startTime = Date.now();

        // Build query string from scrape config
        const config = getScrapeConfig();
        const params = new URLSearchParams();
        if (config.categories.length) params.set('categories', config.categories.join(','));
        if (config.stores.length) params.set('stores', config.stores.join(','));
        const url = params.toString() ? `${API_URL}?${params}` : API_URL;

        const response = await fetch(url);

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
            updateLastUpdatedDisplay();
            setStatusDot('active');

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
        setStatusDot('');

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
        // category value may be pipe-separated raw names (e.g. "Jeans|Jeans Page 2")
        const catValues = category.split('|').map(s => s.toLowerCase());
        filtered = filtered.filter(item =>
            item.category && catValues.includes(item.category.toLowerCase())
        );
    }

    if (source !== 'all') {
        filtered = filtered.filter(item => item.source === source);
    }

    if (selectedBrands.size > 0) {
        if (brandFilterMode === 'show') {
            filtered = filtered.filter(item => selectedBrands.has(item.brand));
        } else {
            filtered = filtered.filter(item => !selectedBrands.has(item.brand));
        }
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
        const tier = getBrandTier(item.brand);
        const sourceClass = getSourceClass(item.source) || 'default';

        return `
        <div class="item-card" style="animation-delay: ${Math.min(index * 20, 200)}ms">
            <div class="item-header">
                <div class="item-meta">
                    <span class="item-source ${sourceClass}">${escapeHtml(item.source)}</span>
                    <span class="brand-tier tier-${tier}">${getTierDisplayName(tier)}</span>
                </div>
                <div class="item-brand">
                    ${escapeHtml(item.brand && item.brand !== 'Unknown' ? item.brand : 'Unknown')}
                    ${item.brand && item.brand !== 'Unknown' ? `
                    <button class="fav-btn ${isFavorite ? 'is-favorite' : ''}" onclick="toggleFavoriteBrand('${escapedBrand}')" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>` : ''}
                </div>
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-category">${escapeHtml(item.category || 'Uncategorized')}</div>
            </div>
            <div class="item-pricing">
                <div class="price-row">
                    <div class="price-details">
                        <span class="current-price">${escapeHtml(item.current_price)}</span>
                        <div class="price-line">
                            ${item.original_price && item.original_price !== 'N/A' ? `<span class="original-price">${escapeHtml(item.original_price)}</span>` : ''}
                            ${savingsDisplay ? `<span class="savings-pill">-${savingsDisplay}</span>` : ''}
                        </div>
                        ${item.discount_percent > 0 ? `<span class="discount-badge ${getDiscountClass(item.discount_percent)}">${item.discount_percent}% off</span>` : ''}
                    </div>
                    <div class="score-badge ${scoreClass}">
                        <span class="score-value">${dealScore}</span>
                        <span class="score-tag">${scoreLabel.split(' ')[0]}</span>
                    </div>
                </div>
            </div>
            <div class="item-footer">
                <div class="sparkline-wrap" data-pid="${item.product_id || ''}"></div>
                ${item.url && !item.url.endsWith('#') ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn-view${dealScore >= 90 ? ' btn-exceptional' : dealScore >= 75 ? ' btn-great' : ''}">${dealScore >= 90 ? '🔥 Hot Deal' : dealScore >= 75 ? 'Great Deal' : 'View Deal'}</a>` : '<button class="btn-view" disabled>No Link</button>'}
            </div>
        </div>
    `}).join('');

    // Attach product_id data attr to each card and fetch sparkline history
    const pageItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const cards = document.querySelectorAll('.item-card');
    cards.forEach((card, i) => {
        const item = pageItems[i];
        if (item && item.product_id) card.dataset.productId = item.product_id;
    });
    fetchHistoryForPage(pageItems);
}

// Clear search input
function clearSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    input.value = '';
    clearBtn.classList.remove('visible');
    currentPage = 1;
    filterAndDisplay();
}

// Update header stats
function updateStats(items) {
    // Nav bar stats
    document.getElementById('totalItems').textContent = items.length;

    if (items.length > 0) {
        const avgDiscount = items.reduce((sum, item) => sum + (item.discount_percent || 0), 0) / items.length;
        document.getElementById('avgDiscount').textContent = Math.round(avgDiscount) + '%';
    } else {
        document.getElementById('avgDiscount').textContent = '0%';
    }

    // Results header below dashboard
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const resultsCount = document.getElementById('resultsCount');
    const resultsPage = document.getElementById('resultsPage');
    if (resultsCount) resultsCount.textContent = `${items.length.toLocaleString()} deals`;
    if (resultsPage && totalPages > 1) {
        resultsPage.textContent = `Page ${currentPage} of ${totalPages}`;
    } else if (resultsPage) {
        resultsPage.textContent = '';
    }
}

// Update all dropdowns
function updateDropdowns() {
    updateCategories();
    updateBrands();
}

// Strip " Page N" suffix from category names (e.g. "Clothing Page 2" → "Clothing")
function normalizeCategory(cat) {
    return cat.replace(/\s+Page\s+\d+$/i, '').trim();
}

// Map raw scraper categories → grouped display names
const CATEGORY_DISPLAY = {
    'tops': 'Tops & Shirts',
    'tops & shirts': 'Tops & Shirts',
    't-shirts': 'Tops & Shirts',
    't-shirts & singlets': 'Tops & Shirts',
    'shirts': 'Tops & Shirts',
    'shirts & polos': 'Tops & Shirts',
    'polos': 'Tops & Shirts',
    'jeans': 'Jeans',
    'pants': 'Pants & Trousers',
    'trousers & chinos': 'Pants & Trousers',
    'trousers & leggings': 'Pants & Trousers',
    'shorts': 'Shorts',
    'shoes': 'Shoes',
    'sneakers': 'Shoes',
    'boots': 'Shoes',
    'casual shoes': 'Shoes',
    'dress shoes': 'Shoes',
    'sandals': 'Shoes',
    'sandals & thongs': 'Shoes',
    'mules & slides': 'Shoes',
    'trainers': 'Shoes',
    'slip ons & loafers': 'Shoes',
    'jackets & coats': 'Jackets & Coats',
    'coats & jackets': 'Jackets & Coats',
    'jackets': 'Jackets & Coats',
    'knitwear': 'Knitwear & Hoodies',
    'jumpers & cardigans': 'Knitwear & Hoodies',
    'sweats & hoodies': 'Knitwear & Hoodies',
    'hoodies & sweatshirts': 'Knitwear & Hoodies',
    'activewear': 'Activewear',
    'swimwear': 'Swimwear',
    'suits': 'Suits & Blazers',
    'suits & blazers': 'Suits & Blazers',
    'accessories': 'Accessories',
    'bags': 'Bags & Accessories',
    'underwear': 'Underwear & Socks',
    'socks': 'Underwear & Socks',
    'base layers': 'Underwear & Socks',
    'clothing': 'Clothing',
    'clearance': 'Clearance',
    'sale': 'Clearance',
    'laptops': 'Electronics',
    'headphones': 'Electronics',
    'speakers': 'Electronics',
    'tvs': 'Electronics',
    'phones': 'Electronics',
    'gaming': 'Electronics',
    'cameras': 'Electronics',
    'smart home': 'Electronics',
    'wearables': 'Electronics',
    'audio': 'Electronics',
};

function getCategoryGroup(raw) {
    const norm = normalizeCategory(raw);
    return CATEGORY_DISPLAY[norm.toLowerCase()] || norm;
}

// Update categories dropdown — grouped and deduplicated
function updateCategories() {
    // Build map: display group → set of raw category values that match
    const groupToRaws = {};
    cachedItems.forEach(item => {
        if (!item.category) return;
        const group = getCategoryGroup(item.category);
        if (!groupToRaws[group]) groupToRaws[group] = new Set();
        groupToRaws[group].add(item.category);
    });

    const select = document.getElementById('category');
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Categories</option>';

    Object.keys(groupToRaws).sort().forEach(group => {
        const option = document.createElement('option');
        // Store pipe-separated raw values as the option value
        option.value = Array.from(groupToRaws[group]).join('|');
        option.textContent = group;
        select.appendChild(option);
    });

    // Try to restore previous selection by matching display label
    const opts = Array.from(select.options);
    const match = opts.find(o => o.value === currentValue || o.textContent === currentValue);
    select.value = match ? match.value : 'all';
}

// ── Brand filter state ──────────────────────────────────────────────────────
let brandFilterMode = 'show';   // 'show' = show only selected | 'hide' = exclude selected
let selectedBrands = new Set(); // brands chosen in the picker
let allScrapedBrands = [];      // sorted list of brands from current scrape

function loadBrandFilterState() {
    try {
        const saved = localStorage.getItem('discountFinder_brandFilter');
        if (saved) {
            const s = JSON.parse(saved);
            brandFilterMode = s.mode || 'show';
            selectedBrands = new Set(s.selected || []);
        }
    } catch (e) {}
}

function saveBrandFilterState() {
    try {
        localStorage.setItem('discountFinder_brandFilter', JSON.stringify({
            mode: brandFilterMode,
            selected: Array.from(selectedBrands)
        }));
    } catch (e) {}
}

function setBrandFilterMode(mode) {
    brandFilterMode = mode;
    selectedBrands.clear();
    document.querySelectorAll('.brand-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    saveBrandFilterState();
    renderBrandList();
    filterAndDisplay();
}

function toggleBrandSelection(brand) {
    if (selectedBrands.has(brand)) {
        selectedBrands.delete(brand);
    } else {
        selectedBrands.add(brand);
    }
    saveBrandFilterState();
    renderBrandList();
    filterAndDisplay();
}

function clearBrandFilter() {
    selectedBrands.clear();
    saveBrandFilterState();
    renderBrandList();
    filterAndDisplay();
}

function filterBrandList() {
    renderBrandList();
}

function renderBrandList() {
    const container = document.getElementById('brandList');
    const footer = document.getElementById('brandFilterFooter');
    const summary = document.getElementById('brandFilterSummary');
    const searchVal = (document.getElementById('brandSearchInput')?.value || '').toLowerCase();

    // Sync tab active state
    document.querySelectorAll('.brand-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === brandFilterMode));

    const visible = searchVal
        ? allScrapedBrands.filter(b => b.toLowerCase().includes(searchVal))
        : allScrapedBrands;

    container.innerHTML = visible.map(brand => {
        const checked = selectedBrands.has(brand);
        const escaped = brand.replace(/'/g, "\\'");
        return `<label class="brand-item${checked ? ' selected' : ''}">
            <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleBrandSelection('${escaped}')">
            <span>${escapeHtml(brand)}</span>
        </label>`;
    }).join('');

    if (selectedBrands.size > 0) {
        footer.style.display = 'flex';
        const verb = brandFilterMode === 'hide' ? 'Hiding' : 'Showing only';
        summary.textContent = `${verb} ${selectedBrands.size} brand${selectedBrands.size > 1 ? 's' : ''}`;
    } else {
        footer.style.display = 'none';
    }
}

function updateBrands() {
    const brands = new Set();
    cachedItems.forEach(item => {
        if (item.brand && item.brand !== 'Unknown') brands.add(item.brand);
    });
    allScrapedBrands = Array.from(brands).sort();
    // Remove any selected brands that no longer exist in the data
    selectedBrands = new Set([...selectedBrands].filter(b => brands.has(b)));
    renderBrandList();
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
            updateLastUpdatedDisplay();
            setStatusDot('active');

            const statusEl = document.getElementById('statusText');
            if (lastScrapedTime) {
                statusEl.textContent = `Loaded ${cachedItems.length} cached items`;
            }
        }
    } catch (e) {
        console.warn('Could not load from localStorage');
    }
}

// Update the Last Updated display in header
function updateLastUpdatedDisplay() {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastScrapedTime && lastUpdatedEl) {
        const date = new Date(lastScrapedTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (diffMins < 1) {
            timeAgo = 'Just now';
        } else if (diffMins < 60) {
            timeAgo = `${diffMins}m ago`;
        } else if (diffHours < 24) {
            timeAgo = `${diffHours}h ago`;
        } else {
            timeAgo = `${diffDays}d ago`;
        }
        lastUpdatedEl.textContent = timeAgo;
        lastUpdatedEl.title = date.toLocaleString();
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

// Reset all filters to smart defaults and persist
function resetFilters() {
    applyFilterState(FILTER_DEFAULTS);
    document.getElementById('category').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear')?.classList.remove('visible');
    selectedBrands.clear();
    if (document.getElementById('brandSearchInput')) document.getElementById('brandSearchInput').value = '';
    saveBrandFilterState();
    renderBrandList();
    saveFilterState();
    currentPage = 1;
    filterAndDisplay();
}

// ============ STATS DASHBOARD ============

// Unified design palette for all charts
const CHART_PALETTE = {
    // Score tiers — consistent with deal score badges
    scoreMeh:        '#d1d1d6',
    scoreFair:       '#aeaeb2',
    scoreGood:       '#007aff',
    scoreGreat:      '#34c759',
    scoreExcept:     '#ff9f0a',
    // Brand tiers
    luxury:          '#ff9f0a',
    premium:         '#007aff',
    midrange:        '#34c759',
    budget:          '#aeaeb2',
    unknown:         '#e5e5ea',
    // Category palette — 8 analogous blues/purples
    cat: ['#007aff','#5e5ce6','#af52de','#ff375f','#ff9f0a','#30d158','#40c8e0','#64d2ff'],
};

const CHART_DEFAULTS = {
    gridColor: 'rgba(0,0,0,0.04)',
    tickColor: '#86868b',
    tickSize: 11,
    tooltipBg: '#1d1d1f',
    tooltipColor: '#ffffff',
    tooltipRadius: 8,
    tooltipPadding: 10,
};

function chartTooltipPlugin() {
    return {
        backgroundColor: CHART_DEFAULTS.tooltipBg,
        titleColor: CHART_DEFAULTS.tooltipColor,
        bodyColor: CHART_DEFAULTS.tooltipColor,
        cornerRadius: CHART_DEFAULTS.tooltipRadius,
        padding: CHART_DEFAULTS.tooltipPadding,
        displayColors: true,
        boxWidth: 10,
        boxHeight: 10,
        boxPadding: 4,
    };
}

function chartScaleDefaults() {
    return {
        y: {
            beginAtZero: true,
            grid: { color: CHART_DEFAULTS.gridColor, drawBorder: false },
            ticks: { color: CHART_DEFAULTS.tickColor, font: { size: CHART_DEFAULTS.tickSize }, maxTicksLimit: 5 },
            border: { display: false }
        },
        x: {
            grid: { display: false },
            ticks: { color: CHART_DEFAULTS.tickColor, font: { size: CHART_DEFAULTS.tickSize } },
            border: { display: false }
        }
    };
}

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
    const totalSavings = items.reduce((sum, item) => {
        const original = parsePrice(item.original_price);
        const current = parsePrice(item.current_price);
        return sum + Math.max(0, original - current);
    }, 0);
    document.getElementById('totalSavings').textContent = '$' + Math.round(totalSavings).toLocaleString();

    const bestScore = items.length ? Math.max(...items.map(item => calculateDealScore(item))) : 0;
    document.getElementById('bestDealScore').textContent = bestScore;

    const avgPrice = items.reduce((sum, item) => sum + parsePrice(item.current_price), 0) / items.length;
    document.getElementById('avgPrice').textContent = '$' + Math.round(avgPrice);

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

    const categoryCounts = {};
    items.forEach(item => {
        const cat = item.category ? getCategoryGroup(item.category) : 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sorted.map(([cat]) => cat);
    const data = sorted.map(([, count]) => count);

    if (chartInstances.category) chartInstances.category.destroy();

    chartInstances.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: CHART_PALETTE.cat,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 10,
                        font: { size: 11 },
                        color: '#6e6e73',
                        generateLabels(chart) {
                            const original = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
                            return original.map(l => ({ ...l, text: l.text.length > 14 ? l.text.slice(0, 13) + '…' : l.text }));
                        }
                    }
                },
                tooltip: {
                    ...chartTooltipPlugin(),
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} deals`
                    }
                }
            }
        }
    });
}

function updateTierChart(items) {
    const ctx = document.getElementById('tierChart').getContext('2d');

    const tierCounts = { luxury: 0, premium: 0, midrange: 0, budget: 0, unknown: 0 };
    items.forEach(item => { tierCounts[getBrandTier(item.brand)]++; });

    const labels = ['Luxury', 'Premium', 'Mid', 'Budget', 'Other'];
    const data = [tierCounts.luxury, tierCounts.premium, tierCounts.midrange, tierCounts.budget, tierCounts.unknown];
    const colors = [CHART_PALETTE.luxury, CHART_PALETTE.premium, CHART_PALETTE.midrange, CHART_PALETTE.budget, CHART_PALETTE.unknown];

    if (chartInstances.tier) chartInstances.tier.destroy();

    chartInstances.tier = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 40,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltipPlugin(),
                    callbacks: { label: ctx => ` ${ctx.parsed.y} deals` }
                }
            },
            scales: chartScaleDefaults()
        }
    });
}

function updatePriceChart(items) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    const bucketKeys = ['<$25', '$25–50', '$50–100', '$100–200', '$200–500', '$500+'];
    const buckets = [0, 0, 0, 0, 0, 0];

    items.forEach(item => {
        const price = parsePrice(item.current_price);
        if (price <= 25) buckets[0]++;
        else if (price <= 50) buckets[1]++;
        else if (price <= 100) buckets[2]++;
        else if (price <= 200) buckets[3]++;
        else if (price <= 500) buckets[4]++;
        else buckets[5]++;
    });

    if (chartInstances.price) chartInstances.price.destroy();

    chartInstances.price = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bucketKeys,
            datasets: [{
                data: buckets,
                backgroundColor: '#007aff',
                hoverBackgroundColor: '#5ac8fa',
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 40,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltipPlugin(),
                    callbacks: { label: ctx => ` ${ctx.parsed.y} items` }
                }
            },
            scales: chartScaleDefaults()
        }
    });
}

function updateScoreChart(items) {
    const ctx = document.getElementById('scoreChart').getContext('2d');

    const bucketKeys = ['Meh', 'Fair', 'Good', 'Great', 'Exceptional'];
    const buckets = [0, 0, 0, 0, 0];
    const colors = [
        CHART_PALETTE.scoreMeh,
        CHART_PALETTE.scoreFair,
        CHART_PALETTE.scoreGood,
        CHART_PALETTE.scoreGreat,
        CHART_PALETTE.scoreExcept,
    ];

    items.forEach(item => {
        const score = calculateDealScore(item);
        if (score < 40) buckets[0]++;
        else if (score < 60) buckets[1]++;
        else if (score < 75) buckets[2]++;
        else if (score < 90) buckets[3]++;
        else buckets[4]++;
    });

    if (chartInstances.score) chartInstances.score.destroy();

    chartInstances.score = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bucketKeys,
            datasets: [{
                data: buckets,
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 56,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...chartTooltipPlugin(),
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} deals`
                    }
                }
            },
            scales: {
                ...chartScaleDefaults(),
                x: {
                    grid: { display: false },
                    ticks: { color: CHART_DEFAULTS.tickColor, font: { size: 12, weight: '500' } },
                    border: { display: false }
                }
            }
        }
    });
}

// ============ PRICE HISTORY ============

const HISTORY_API = window.location.hostname === 'localhost'
    ? 'http://localhost:8080/api/history'
    : '/api/history';

// Cache of product_id → [{price, scraped_at}]
const priceHistoryCache = {};

async function fetchHistoryForPage(items) {
    const ids = items
        .map(i => i.product_id)
        .filter(id => id && !priceHistoryCache[id]);

    if (ids.length === 0) return;

    try {
        const url = `${HISTORY_API}?product_ids=${ids.join(',')}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.success && data.history) {
            Object.assign(priceHistoryCache, data.history);
            renderSparklines(items);
        }
    } catch (e) {
        console.warn('Price history fetch failed:', e);
    }
}

function renderSparklines(items) {
    items.forEach(item => {
        if (!item.product_id) return;
        const history = priceHistoryCache[item.product_id];
        if (!history || history.length < 2) return;

        const container = document.querySelector(`.sparkline-wrap[data-pid="${item.product_id}"]`);
        if (!container || container.dataset.rendered) return;
        container.dataset.rendered = '1';

        const prices = [...history].reverse().map(h => h.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const first = prices[0];
        const last = prices[prices.length - 1];
        const trending = last < first ? 'down' : last > first ? 'up' : 'flat';

        const w = 80, h = 28, pad = 2;
        const points = prices.map((p, i) => {
            const x = pad + (i / Math.max(prices.length - 1, 1)) * (w - pad * 2);
            const y = max === min ? h / 2 : pad + ((max - p) / (max - min)) * (h - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');

        const lastPoint = points.split(' ').pop().split(',');
        const color = trending === 'down' ? '#16a34a' : trending === 'up' ? '#dc2626' : '#94a3b8';
        const label = trending === 'down' ? '↓ dropping' : trending === 'up' ? '↑ rising' : '→ stable';

        container.innerHTML = `
            <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="sparkline-svg">
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="2" fill="${color}"/>
            </svg>
            <span class="sparkline-label" style="color:${color}">${label}</span>
        `;
    });
}

