# Revelstoke Mountain Dashboard

A simple, lightweight dashboard for monitoring real-time conditions at Revelstoke Mountain Resort in British Columbia, Canada. Displays current weather, snow reports, and live webcam feeds in a clean, dark-themed interface.

## Features

- **Real-time Weather Data**: Current temperature, conditions, wind speed, and multi-elevation readings
- **Snow Report**: Recent snowfall amounts (overnight, 24hr, 48hr)
- **Live Webcams**: Four different camera angles showing current mountain conditions
- **Auto-refresh**: Data updates automatically every 10 minutes
- **Manual Refresh**: Click the refresh button for immediate updates
- **Dark Theme**: Easy on the eyes for extended viewing
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **No Dependencies**: Pure HTML, CSS, and JavaScript - no build tools required

## Quick Start

### Option 1: Open Directly in Browser

The simplest way to view the dashboard:

1. Navigate to the project directory
2. Double-click `index.html` to open in your default browser

**Note**: Some browsers may block the API requests due to CORS policies when opening files directly. If this happens, use one of the server options below.

### Option 2: Python HTTP Server (Recommended)

If you have Python installed:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open your browser to: `http://localhost:8000`

### Option 3: Node.js HTTP Server

If you have Node.js installed:

```bash
# Install http-server globally (one time)
npm install -g http-server

# Run the server
http-server -p 8000
```

Then open your browser to: `http://localhost:8000`

### Option 4: PHP Built-in Server

If you have PHP installed:

```bash
php -S localhost:8000
```

Then open your browser to: `http://localhost:8000`

## Deployment

### Static Hosting Platforms

This website can be deployed to any static hosting platform. Here are some popular options:

#### GitHub Pages

1. Create a new GitHub repository
2. Push the project files
3. Go to Settings > Pages
4. Select the branch to deploy (usually `main` or `master`)
5. Your site will be live at `https://yourusername.github.io/repository-name`

#### Netlify

1. Create a free account at [netlify.com](https://www.netlify.com)
2. Drag and drop the project folder into the Netlify dashboard
3. Your site will be live instantly with a custom URL

#### Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to deploy

#### Cloudflare Pages

1. Create a Cloudflare account
2. Go to Pages and create a new project
3. Connect your Git repository or upload files directly
4. Deploy

### Traditional Web Hosting

Upload all files via FTP/SFTP to your web server's public directory:

```
public_html/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Project Structure

```
revy-tv-new/
├── index.html      # Main HTML structure
├── styles.css      # Dark theme styling and responsive layout
├── app.js          # Data fetching and update logic
└── README.md       # This file
```

## Data Sources

The dashboard pulls data from official Revelstoke Mountain Resort sources:

- **Weather**: https://www.revelstokemountainresort.com/snow-weather-json/
- **Webcams**:
  - Gnorm Cam: Resort uploads directory
  - KPMC Cam: Ozolio relay API
  - Ripper Cam: Resort uploads directory
  - PVWK Cam: Ozolio relay API

All data refreshes automatically every 10 minutes. Webcam images are cache-busted to ensure fresh images.

## Customization

### Change Refresh Interval

Edit `app.js` and modify the `refreshInterval` value (in milliseconds):

```javascript
const CONFIG = {
    // ... other config
    refreshInterval: 600000 // 10 minutes (600,000 ms)
};
```

Examples:
- 5 minutes: `300000`
- 15 minutes: `900000`
- 1 minute: `60000`

### Modify Color Scheme

Edit `styles.css` to change colors:

```css
body {
    background-color: #1a1a1a;  /* Main background */
    color: #e0e0e0;              /* Text color */
}

.card {
    background-color: #2d2d2d;   /* Card background */
}

h2 {
    color: #4a9eff;              /* Accent color (blue) */
}
```

### Add/Remove Webcams

Edit `app.js` to modify the webcam configuration:

```javascript
const CONFIG = {
    webcams: {
        gnorm: 'url-here',
        // Add or remove webcam URLs
    }
};
```

Then update `index.html` to add/remove corresponding webcam elements.

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Technical Details

- **No Build Tools**: No webpack, npm, or bundlers required
- **Zero Dependencies**: No external JavaScript libraries
- **Vanilla JavaScript**: ES6+ with async/await
- **CSS Grid**: Modern layout using CSS Grid and Flexbox
- **Fetch API**: Native browser API for data fetching
- **Mobile-First**: Responsive design with mobile breakpoints

## Troubleshooting

### Data Not Loading

1. **Check Console**: Open browser DevTools (F12) and check the Console tab for errors
2. **CORS Issues**: If seeing CORS errors, run via a local server (see Quick Start options)
3. **API Changes**: Revelstoke may update their API endpoints - check if URLs are still valid

### Webcams Not Showing

1. **Check URLs**: Webcam URLs may change - verify they're still accessible
2. **Cache Issues**: Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
3. **Blocked Content**: Check if browser is blocking mixed content (HTTP on HTTPS page)

### Auto-Refresh Not Working

1. **Tab Backgrounded**: Some browsers throttle background tabs - bring tab to foreground
2. **Console Errors**: Check DevTools console for JavaScript errors

## License

This project is open source and available for personal use. Data is sourced from Revelstoke Mountain Resort and remains their property.

## Acknowledgments

- Weather and snow data provided by Revelstoke Mountain Resort
- Webcam feeds from Revelstoke Mountain Resort and Ozolio

---

**Enjoy monitoring the conditions at Revelstoke Mountain!** 🏔️❄️
