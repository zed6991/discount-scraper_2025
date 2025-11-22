# 🛍️ Discount Scraper

Free discount deals from David Jones and Iconic. Access from your phone anywhere!

## ✨ Features

✅ Real-time scraping from David Jones & Iconic
✅ Mobile-friendly responsive interface
✅ Filter by store, category, discount %
✅ Works from anywhere (no WiFi needed)
✅ Completely free (GitHub Pages + Vercel)
✅ Automatic daily updates (GitHub Actions)

## 🚀 Quick Deploy (15 minutes)

### 1. Create GitHub Repo
- Go to [github.com/new](https://github.com/new)
- Name: `discount-scraper`
- Make it **PUBLIC**

### 2. Push Code
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/discount-scraper.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 3. Enable GitHub Pages
- Settings → Pages
- Source: `main` branch, `/docs` folder

### 4. Deploy to Vercel
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repo
- Deploy

### 5. Update API URL
Edit `docs/js/app.js` line 5:
```javascript
const API_URL = 'https://YOUR_PROJECT_NAME.vercel.app/api/scrape';
```

Push update:
```bash
git add docs/js/app.js
git commit -m "Update Vercel URL"
git push
```

### 6. Access Your App
Visit: `https://YOUR_USERNAME.github.io/discount-scraper`

## 📱 Use on Phone

1. Open browser on phone
2. Go to: `https://YOUR_USERNAME.github.io/discount-scraper`
3. Bookmark it (add to home screen)
4. Click "Scrape Now"
5. Browse deals!

## 🎯 Architecture

```
Your Phone
    ↓
GitHub Pages (Frontend)
    ↓ API Call
Vercel (Backend Scraper)
    ↓ HTTP Requests
David Jones & Iconic
    ↓
Results back to phone
```

## 📂 File Structure

```
discount-scraper/
├── docs/                  (GitHub Pages)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── api/
│   └── scrape.py         (Vercel endpoint)
├── .github/workflows/
│   └── scrape.yml        (Daily automation)
├── discount_scraper.py   (Scraper code)
├── requirements.txt
├── vercel.json
└── README.md
```

## 💰 Cost

- GitHub Pages: **FREE**
- Vercel: **FREE** (100GB/month)
- GitHub Actions: **FREE** (2000 min/month)

**Total: $0/month** 💰

## 🔧 Customization

### Change to Women's Products
Edit `discount_scraper.py`:
```python
'gender': 'Women'
sale_url = f"{self.base_url}/womens/sale"
```

### Change Colors
Edit `docs/css/style.css`

### Add More Stores
Create new scraper class in `discount_scraper.py`

## 🆘 Troubleshooting

**GitHub Pages shows 404**
- Check Settings → Pages (main branch, /docs folder)
- Wait 1-2 minutes for GitHub to build

**API error**
- Check Vercel deployment successful
- Check API URL in `docs/js/app.js` is correct
- Open browser console (F12) for errors

**0 items found**
- Website HTML structure may have changed
- Update CSS selectors in `discount_scraper.py`

## 📊 Performance

- Page load: < 1 second
- Scraping: 30-60 seconds
- Results display: instant
- Mobile optimized: ✅

## 📞 Support

See files in project folder or check browser console (F12) for error messages.

## 📝 License

MIT - Free to use and modify!

---

**Happy hunting! 🛍️**
