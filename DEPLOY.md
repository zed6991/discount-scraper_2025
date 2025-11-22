# 🚀 Deploy to GitHub in 15 Minutes

A clean, simple guide to get your discount scraper live on GitHub!

---

## ✅ What You Have

- ✅ Scraper code (`discount_scraper.py`)
- ✅ Frontend files (`docs/` folder)
- ✅ Backend API (`api/scrape.py`)
- ✅ Configuration files
- ✅ Everything ready to go!

---

## 🎯 6 Simple Steps

### Step 1: Create GitHub Repo (1 min)

1. Go to [github.com/new](https://github.com/new)
2. **Name:** `discount-scraper`
3. **Description:** Discount scraper for David Jones & Iconic
4. **Make it PUBLIC** ← Important!
5. Click **Create repository**

### Step 2: Push Code to GitHub (2 min)

Open Command Prompt in your project folder:

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/discount-scraper.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

**Authentication:**
- Use your GitHub username
- For password: Use a Personal Access Token (GitHub → Settings → Developer settings)

### Step 3: Enable GitHub Pages (1 min)

1. Go to your repo on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. **Source:** Select `main` branch, `/docs` folder
5. Click **Save**

GitHub shows: `https://YOUR_USERNAME.github.io/discount-scraper`

### Step 4: Deploy to Vercel (3 min)

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** (or sign in with GitHub)
3. Click **New Project**
4. Click **Import Git Repository**
5. Select your `discount-scraper` repo
6. Click **Import**
7. Click **Deploy**

Vercel shows: `https://YOUR_PROJECT_NAME.vercel.app`

### Step 5: Update API URL (1 min)

1. Go to your repo on GitHub
2. Click `docs` folder
3. Click `js` folder
4. Click `app.js`
5. Click the **edit** button (pencil icon)

Find this line (line ~5):
```javascript
const API_URL = 'https://YOUR_PROJECT_NAME.vercel.app/api/scrape';
```

Replace `YOUR_PROJECT_NAME` with your actual Vercel project name.

**Example:**
```javascript
const API_URL = 'https://discount-scraper-zaeed.vercel.app/api/scrape';
```

Scroll down, click **Commit changes**, add message:
```
Update Vercel API URL
```

### Step 6: Done! 🎉

Your app is live! Access it:

**Computer:** Visit in browser
```
https://YOUR_USERNAME.github.io/discount-scraper
```

**Phone:** Same URL, bookmark it!
```
https://YOUR_USERNAME.github.io/discount-scraper
```

---

## 🎬 What to Expect

1. **GitHub Pages:** Deploys in 1-2 minutes
2. **Vercel:** Deploys in 1-2 minutes
3. **First scrape:** Takes 30-60 seconds
4. **Results:** Display instantly after scraping

---

## 🔍 Finding Your URLs

**GitHub Pages:**
```
https://YOUR_USERNAME.github.io/discount-scraper
```
(Replace YOUR_USERNAME with your actual username)

**Vercel:**
```
https://YOUR_PROJECT_NAME.vercel.app
```
(Shown in Vercel dashboard after deployment)

**Vercel API Endpoint:**
```
https://YOUR_PROJECT_NAME.vercel.app/api/scrape
```
(This goes in docs/js/app.js)

---

## ✅ Quick Checklist

- [ ] Created GitHub account (free)
- [ ] GitHub repo created (public)
- [ ] Code pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] Vercel account created
- [ ] Vercel deployment successful
- [ ] Updated API URL in app.js
- [ ] Final push to GitHub
- [ ] Access from phone works

---

## 🆘 If Something Goes Wrong

**GitHub Pages shows 404:**
- Settings → Pages shows `/docs` folder? Yes?
- Does `/docs/index.html` exist? Yes?
- Wait 1-2 minutes for GitHub to build

**API error on frontend:**
- Check Vercel deployment successful
- Check API URL in `app.js` is correct (no typos!)
- Open browser console (F12) for details

**Vercel deployment fails:**
- Check `requirements.txt` exists
- Check `api/scrape.py` exists
- Check `discount_scraper.py` in root

---

## 🎊 Success Looks Like

1. GitHub Pages loads instantly
2. Frontend looks beautiful
3. "Scrape Now" button appears
4. Clicking it shows results after 30-60 seconds
5. Works perfectly on phone
6. Can bookmark it

---

## 📱 Use on Phone

1. Open browser on phone
2. Go to: `https://USERNAME.github.io/discount-scraper`
3. Tap the share icon
4. **"Add to Home Screen"** ← Creates app icon
5. Opens instantly every time!

---

## 💡 After Deployment

**Your app will:**
- ✅ Work 24/7 (no computer needed)
- ✅ Be accessible from anywhere
- ✅ Update automatically (GitHub Actions daily)
- ✅ Cost $0/month forever
- ✅ Be shareable with friends

---

## 🚀 That's It!

You're done! Your discount scraper is now live online and accessible from your phone anywhere!

**Enjoy finding deals!** 🛍️

---

**Questions?**
- Check `README.md` for more info
- Check browser console (F12) for errors
- Vercel dashboard shows deployment logs
- GitHub Actions shows scraping logs
