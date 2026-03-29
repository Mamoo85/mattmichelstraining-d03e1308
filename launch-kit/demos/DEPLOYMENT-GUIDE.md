# DEMO DEPLOYMENT GUIDE
## Get Your Portfolio Live in 30 Minutes

---

## WHAT YOU'RE DEPLOYING

You have **5 professional website demos** + **1 portfolio landing page**:

1. **Portfolio Landing Page** - Showcases all your demos
2. **Modern Light** (index.html) - Clean minimal design
3. **Modern Light Variant** (light.html) - Alternative color scheme
4. **Corporate Professional** (corporate.html) - Bold authoritative design
5. **Corporate Variant** (corporate2.html) - Alternative layout
6. **Fresh & Modern** (light2.html) - Vibrant welcoming design

---

## OPTION 1: VERCEL (RECOMMENDED - EASIEST)

### Step 1: Prepare Files (5 minutes)

On your computer, create this folder structure:

```
portfolio-site/
├── index.html (portfolio landing page)
├── public/
│   ├── images/
│   │   ├── engineered-cell.jpg
│   │   ├── hydraulics-actual.jpg
│   │   ├── robotic-arm-actual.jpg
│   │   └── dental-doctor.jpg
│   └── demo-youngblood/
│       ├── index.html
│       ├── light.html
│       ├── light2.html
│       ├── corporate.html
│       └── corporate2.html
```

**Get the files:**
```bash
# Create folder on your desktop
mkdir ~/Desktop/portfolio-site
cd ~/Desktop/portfolio-site

# Copy files from your workspace
cp /workspaces/m2training/launch-kit/demos/portfolio-landing.html ./index.html
cp -r /workspaces/m2training/public/demo-youngblood ./
cp -r /workspaces/m2training/public/images ./
```

**Or manually:**
1. Copy files from `/workspaces/m2training/launch-kit/demos/` and `/workspaces/m2training/public/`
2. Organize them as shown above

---

### Step 2: Deploy to Vercel (5 minutes)

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up** with GitHub (free account)
3. **Click "Add New Project"**
4. **Click "Browse"** and select your `portfolio-site` folder
5. **Click "Deploy"**

That's it! Vercel will:
- Upload your files
- Generate a URL (like `portfolio-site-abc123.vercel.app`)
- Make it live in ~30 seconds

---

### Step 3: Test Your Site (5 minutes)

1. Click the generated URL
2. Test every demo link
3. Check on mobile (open on your phone)
4. Verify all images load

---

### Step 4: Get Custom Domain (10 minutes)

**Buy domain:**
1. Go to [Namecheap.com](https://namecheap.com)
2. Search for available domain:
   - `metrodetroitwebsolutions.com`
   - `[yourname]websolutions.com`
   - `[yourname]web.com`
3. Buy it (~$10-15/year)

**Connect to Vercel:**
1. In Vercel, go to your project settings
2. Click "Domains"
3. Add your custom domain
4. Follow Vercel's instructions to update DNS
5. Wait 5-60 minutes for DNS to propagate

**Done!** Your portfolio is now at your custom domain.

---

## OPTION 2: NETLIFY (ALSO EASY)

### Step 1: Prepare Files (same as Option 1)

### Step 2: Deploy to Netlify

1. **Go to [netlify.com](https://netlify.com)**
2. **Sign up** (free account)
3. **Drag your `portfolio-site` folder** into Netlify dashboard
4. **Click "Deploy"**

Netlify generates URL like `portfolio-site.netlify.app`

### Step 3: Custom Domain

1. In Netlify, go to "Domain settings"
2. Click "Add custom domain"
3. Enter your domain name
4. Follow DNS setup instructions

---

## OPTION 3: GITHUB PAGES (FREE FOREVER)

### Step 1: Create GitHub Account

1. Go to [github.com](https://github.com)
2. Sign up (free)

### Step 2: Create Repository

1. Click "New Repository"
2. Name it: `[yourusername].github.io`
3. Make it Public
4. Don't add README
5. Click "Create"

### Step 3: Upload Files

1. Click "uploading an existing file"
2. Drag all files from your `portfolio-site` folder
3. Click "Commit changes"

### Step 4: Enable GitHub Pages

1. Go to repository Settings
2. Scroll to "Pages"
3. Source: Deploy from branch "main"
4. Click Save

Your site will be live at: `https://[yourusername].github.io`

### Custom Domain

1. Buy domain from Namecheap
2. In GitHub repo settings → Pages
3. Add custom domain
4. Update DNS in Namecheap:
   - Add CNAME record pointing to `[yourusername].github.io`

---

## UPDATING YOUR PORTFOLIO

**For Vercel/Netlify:**
- Just drag and drop updated files
- Site updates automatically

**For GitHub Pages:**
- Upload new files through GitHub interface
- Or use Git (if you know how)

---

## CUSTOMIZING THE PORTFOLIO PAGE

Edit `/workspaces/m2training/launch-kit/demos/portfolio-landing.html`

**What to change:**

1. **Your contact info:**
```html
<!-- Line 15: Replace with your email -->
<a href="mailto:your@email.com" 

<!-- Line 263: Replace with your phone -->
<a href="tel:+15551234567"

<!-- Update footer with your business name -->
```

2. **Business name (optional):**
```html
<!-- Line 13: Change if desired -->
<h1 class="text-2xl font-black text-blue-600">
  Metro Detroit Web Solutions
</h1>
```

3. **Add your photo (optional):**
Add a photo section in the About area if desired

4. **Update demo links:**
Make sure all demo links work:
```html
<a href="/demo-youngblood/index.html" target="_blank">
```

**Test locally:**
- Just open `index.html` in your browser
- Click all links to make sure they work
- Then deploy updated version

---

## TROUBLESHOOTING

### Images not loading
**Problem:** Demos show broken image icons
**Solution:** Check file paths. Images should be in `/images/` or `/public/images/`

### Demos return 404
**Problem:** Clicking demo links says "Page not found"
**Solution:** Verify folder structure. Demos should be in `/demo-youngblood/` folder

### Custom domain not working
**Problem:** Domain shows error after 1+ hour
**Solution:** 
- Check DNS settings in domain registrar
- Use Vercel/Netlify's DNS checker tool
- DNS can take up to 48 hours (usually 1-2 hours)

### Mobile looks broken
**Problem:** Site doesn't look good on phone
**Solution:** The demos use Tailwind CSS which is responsive. Make sure you didn't accidentally delete viewport meta tag.

---

## COST BREAKDOWN

**Free Option:**
- GitHub Pages: $0
- Custom domain: ~$12/year
- **Total Year 1: $12**

**Paid Option:**
- Vercel/Netlify: Free tier is plenty
- Custom domain: ~$12/year
- **Total Year 1: $12**

**That's it!** Less than a lunch.

---

## PRO TIPS

### 1. Use SSL (HTTPS)
Vercel/Netlify/GitHub Pages all provide free SSL. Make sure it's enabled. Sites without HTTPS look sketchy.

### 2. Add Analytics
Add Google Analytics to track visitors:
```html
<!-- Add before </head> in your HTML -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 3. Add Favicon
Create a simple favicon (icon that shows in browser tab):
- Use [favicon.io](https://favicon.io)
- Generate from text or image
- Add to root folder
- Reference in HTML: `<link rel="icon" href="/favicon.ico">`

### 4. Update Meta Tags
Make sure your portfolio page has good meta tags for sharing:
```html
<meta name="description" content="Professional website design for Metro Detroit contractors. See live demos and get your business online in 7 days.">
<meta property="og:title" content="Metro Detroit Web Solutions">
<meta property="og:description" content="Modern, mobile-friendly websites for local contractors">
```

### 5. Test Everything
Before sending to prospects:
- Click every link
- Test contact form
- Check on iPhone
- Check on Android
- Check on desktop
- Check in different browsers

---

## NEXT STEPS AFTER DEPLOYMENT

1. **Save your URL** - Put it everywhere
2. **Add to email signature**
3. **Test the contact form** - Send yourself a test
4. **Take screenshots** - For social media sharing
5. **Share on LinkedIn/Facebook** - "Just launched my new web design business!"
6. **Start sending to prospects** - Include in cold emails

---

## ALTERNATIVE: USE EXISTING DEPLOYMENT

If you just want to get started fast and already have this workspace deployed:

**Your existing deployment:**
```
Main site: https://[your-vercel-url].vercel.app
Demos: https://[your-vercel-url].vercel.app/demo-youngblood/
```

Just create a simple HTML landing page that links to these demos.

---

## DONE!

You now have:
- ✅ Professional portfolio website
- ✅ 5 working demo sites
- ✅ Custom domain (optional but recommended)
- ✅ Live on the internet
- ✅ Ready to send to prospects

**Time to start your outreach!**

---

**Questions?** Check the FAQ in the main README or reach out for help.
