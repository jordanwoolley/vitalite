# Deployment Guide for Vercel

This guide will help you deploy your Vitality Lite app to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Your Strava API credentials (from https://www.strava.com/settings/api)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Install Dependencies

First, install the new Vercel KV package:

```bash
npm install @vercel/kv
```

## Step 2: Push to Git

Make sure your code is committed and pushed to your Git repository:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository
3. Vercel will auto-detect Next.js

## Step 4: Set Up Vercel KV (Database)

1. In your Vercel project dashboard, go to **Storage** tab
2. Click **Create Database** → Select **KV** (Redis)
3. Give it a name (e.g., "vitality-kv")
4. Select a region close to you
5. Click **Create**

Vercel will automatically add these environment variables:
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

## Step 5: Configure Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add:

### Required Variables:

1. **STRAVA_CLIENT_ID**
   - Value: Your Strava Client ID

2. **STRAVA_CLIENT_SECRET**
   - Value: Your Strava Client Secret

3. **NEXT_PUBLIC_BASE_URL**
   - Value: Your Vercel app URL (e.g., `https://your-app.vercel.app`)
   - Important: Update this after first deployment with your actual URL

### Optional (Auto-configured by Vercel KV):

- `KV_URL` - Auto-added when you create KV store
- `KV_REST_API_URL` - Auto-added
- `KV_REST_API_TOKEN` - Auto-added
- `KV_REST_API_READ_ONLY_TOKEN` - Auto-added

## Step 6: Update Strava OAuth Redirect URL

1. Go to https://www.strava.com/settings/api
2. Update your **Authorization Callback Domain** to your Vercel domain
   - Example: `your-app.vercel.app`
3. Save changes

## Step 7: Redeploy

After setting environment variables, trigger a new deployment:

- Go to **Deployments** tab
- Click the **⋯** menu on the latest deployment
- Select **Redeploy**

Or push a new commit to trigger automatic deployment.

## Local Development

For local development, the app will still use `db.json` file (no KV needed locally).

To use KV locally (optional):
1. Create a KV store in Vercel
2. Copy the KV environment variables to a `.env.local` file
3. The app will automatically use KV if `KV_URL` is set

## Troubleshooting

### Database not working?
- Make sure KV store is created in Vercel
- Check that all KV environment variables are set
- Verify the KV store is in the same region as your app

### OAuth not working?
- Verify `NEXT_PUBLIC_BASE_URL` matches your Vercel domain
- Check Strava callback domain is set correctly
- Ensure `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct

### Build errors?
- Make sure `@vercel/kv` is in `package.json` dependencies
- Run `npm install` locally to verify dependencies

## Migration from Local db.json

If you have existing data in `db.json`:

1. The app will automatically use KV on Vercel (when `KV_URL` is set)
2. Local development will continue using `db.json`
3. To migrate existing data, you can:
   - Start fresh on Vercel (recommended for new deployment)
   - Or create a migration script to copy data from `db.json` to KV

