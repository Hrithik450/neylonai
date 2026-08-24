# SEO Optimization - Required Assets & Configuration

## ✅ Implemented
- Comprehensive metadata in `apps/web/src/app/layout.tsx`
- Dynamic sitemap at `/sitemap.xml`
- Robots.txt at `/robots.txt`
- JSON-LD structured data (Organization, Website, SoftwareApplication)
- Web manifest for PWA support
- Page-specific metadata optimization

## 📋 Required Assets

Please create and place the following files in `apps/web/public/`:

### 1. Open Graph Image (REQUIRED)
**File:** `opengraph-image.png`
- **Size:** 1200 x 630 pixels
- **Format:** PNG or JPG
- **Content:** Should feature:
  - Neylon AI branding/logo
  - Tagline: "Know why visitors leave. Engage them sooner."
  - Visual representation of the product (dashboard/chat interface)
  - Background color: #FFF7F4 (your brand color)
  - Text color: #242424

### 2. Twitter Card Image (REQUIRED)
**File:** `twitter-image.png`
- **Size:** 1200 x 630 pixels (same as OpenGraph)
- **Format:** PNG or JPG
- **Note:** Can be the same as opengraph-image.png

### 3. Favicon Assets (REQUIRED)
Place these in `apps/web/public/`:

- **favicon.ico** (32x32, multi-size ICO format)
- **apple-touch-icon.png** (180x180 pixels)
- **android-chrome-192x192.png** (192x192 pixels)
- **android-chrome-512x512.png** (512x512 pixels)

**Design:** Should feature Neylon AI logo/brand mark

### 4. Logo for Structured Data (OPTIONAL)
**File:** `logo.png`
- **Size:** 600 x 60 pixels (or similar aspect ratio)
- **Format:** PNG with transparent background
- **Content:** Neylon AI wordmark/logo

---

## 🔧 Configuration Required

### 1. Environment Variables
Add to your `.env`:

```bash
# Your production site URL
NEXT_PUBLIC_SITE_URL=https://neylonai.mhrithik.com

# Or for staging/development
# NEXT_PUBLIC_SITE_URL=https://staging.neylonai.mhrithik.com
```

### 2. Google Search Console Verification
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property (https://neylonai.mhrithik.com)
3. Get your verification meta tag code
4. Update `apps/web/src/app/layout.tsx` line with verification code:
   ```typescript
   verification: {
     google: "your-google-verification-code-here",
   },
   ```

### 3. Social Media Handles (Optional but Recommended)
Update in `apps/web/src/app/jsonld.tsx`:
- Twitter handle (line with `twitter.com/neylonai`)
- LinkedIn company page
- GitHub organization
- Other social profiles

---

## 🎨 How to Create Open Graph Images

### Option 1: Design Tools
Use Figma, Canva, or Photoshop with this template:

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Neylon AI Logo]                       │
│                                         │
│  Know why visitors leave.               │
│  Engage them sooner.                    │
│                                         │
│  [Dashboard/Chat Screenshot]            │
│                                         │
│  AI-Powered Customer Engagement         │
└─────────────────────────────────────────┘
```

### Option 2: Automated Tools
- [Vercel OG Image](https://vercel.com/docs/functions/edge-functions/og-image-generation)
- [Cloudinary](https://cloudinary.com/documentation/social_media_cards)
- [Bannerbear](https://www.bannerbear.com/)

---

## 📊 SEO Features Implemented

### Technical SEO
✅ Semantic HTML structure
✅ Dynamic meta tags
✅ Canonical URLs
✅ XML sitemap
✅ Robots.txt
✅ Structured data (JSON-LD)
✅ Mobile-responsive design
✅ Fast page loads (Next.js optimization)

### On-Page SEO
✅ Optimized title tags (under 60 characters)
✅ Meta descriptions (150-160 characters)
✅ Header hierarchy (H1, H2, H3)
✅ Alt text for images (check existing images)
✅ Internal linking structure
✅ Schema markup

### Social Media SEO
✅ Open Graph tags (Facebook, LinkedIn)
✅ Twitter Card tags
✅ Social sharing optimization

---

## 🚀 Next Steps After Adding Assets

1. **Add images to `apps/web/public/`**
2. **Set NEXT_PUBLIC_SITE_URL in environment**
3. **Verify Google Search Console**
4. **Build and deploy:**
   ```bash
   cd apps/web
   pnpm build
   ```
5. **Test SEO:**
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
   - [Google Rich Results Test](https://search.google.com/test/rich-results)

6. **Submit sitemap to Google Search Console:**
   - URL: `https://neylonai.mhrithik.com/sitemap.xml`

---

## 📈 Monitoring & Analytics

Consider adding:
1. **Google Analytics 4** - Track traffic and conversions
2. **Google Search Console** - Monitor search performance
3. **Hotjar/Microsoft Clarity** - User behavior analytics
4. **Ahrefs/Semrush** - SEO monitoring and competitor analysis

---

## 🔍 Keywords Optimized For

Primary: "AI customer engagement", "visitor tracking", "proactive chat"
Secondary: "AI chatbot", "customer engagement platform", "real-time analytics"
Long-tail: "AI-powered customer engagement platform", "real-time visitor tracking software"

---

## 📝 Content Recommendations

Consider adding these pages for better SEO:
1. `/pricing` - Pricing page with structured data
2. `/features` - Detailed features page
3. `/blog` - Content marketing for long-tail keywords
4. `/case-studies` - Customer success stories
5. `/integrations` - Integration directory
6. `/docs` - Documentation/help center

---

## 🎯 Performance Checklist

- [ ] Images added to /public
- [ ] NEXT_PUBLIC_SITE_URL configured
- [ ] Google Search Console verified
- [ ] Open Graph images display correctly
- [ ] Sitemap accessible at /sitemap.xml
- [ ] Robots.txt accessible at /robots.txt
- [ ] Mobile-friendly test passed
- [ ] Page speed score > 90 (Lighthouse)
- [ ] All social media preview links work

---

Need help creating the images? Let me know and I can:
1. Provide exact design specifications
2. Generate code for dynamic OG image generation
3. Recommend design tools/templates
