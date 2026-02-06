// Theme system — loaded synchronously in <head> before CSS to prevent flash
// Sets data-theme attribute on <html> based on localStorage

const THEMES = {
    midnight: {
        label: 'Midnight',
        colors: {
            '--bg-primary': '#0a0a0a',
            '--bg-secondary': '#141414',
            '--bg-card': '#1a1a1a',
            '--bg-elevated': '#222222',
            '--text-primary': '#f0f0f0',
            '--text-secondary': '#888888',
            '--text-muted': '#555555',
            '--accent-primary': '#00ff88',
            '--accent-secondary': '#00ccff',
            '--accent-warning': '#ff3366',
            '--accent-dim': 'rgba(0, 255, 136, 0.15)',
            '--border-color': '#333333',
        }
    },
    arctic: {
        label: 'Arctic',
        colors: {
            '--bg-primary': '#f0f2f5',
            '--bg-secondary': '#ffffff',
            '--bg-card': '#ffffff',
            '--bg-elevated': '#e8edf2',
            '--text-primary': '#1a1a2e',
            '--text-secondary': '#5a6478',
            '--text-muted': '#9aa5b4',
            '--accent-primary': '#0066cc',
            '--accent-secondary': '#0099ff',
            '--accent-warning': '#cc2244',
            '--accent-dim': 'rgba(0, 102, 204, 0.1)',
            '--border-color': '#d0d7e0',
        }
    },
    bluebird: {
        label: 'Bluebird',
        colors: {
            '--bg-primary': '#0b1628',
            '--bg-secondary': '#111d33',
            '--bg-card': '#162240',
            '--bg-elevated': '#1c2d52',
            '--text-primary': '#e0e8f5',
            '--text-secondary': '#7a8faa',
            '--text-muted': '#4a5d78',
            '--accent-primary': '#3b9eff',
            '--accent-secondary': '#64d2ff',
            '--accent-warning': '#ff5c7c',
            '--accent-dim': 'rgba(59, 158, 255, 0.12)',
            '--border-color': '#253a5a',
        }
    },
    powder: {
        label: 'Powder',
        colors: {
            '--bg-primary': '#1a1520',
            '--bg-secondary': '#221c2a',
            '--bg-card': '#2a2335',
            '--bg-elevated': '#332b40',
            '--text-primary': '#e8e0f0',
            '--text-secondary': '#9088a0',
            '--text-muted': '#5e5670',
            '--accent-primary': '#c084fc',
            '--accent-secondary': '#a78bfa',
            '--accent-warning': '#fb7185',
            '--accent-dim': 'rgba(192, 132, 252, 0.12)',
            '--border-color': '#3d3450',
        }
    },
    alpine: {
        label: 'Alpine',
        colors: {
            '--bg-primary': '#141210',
            '--bg-secondary': '#1c1916',
            '--bg-card': '#23201c',
            '--bg-elevated': '#2e2a24',
            '--text-primary': '#ede8e0',
            '--text-secondary': '#9a9080',
            '--text-muted': '#625a4e',
            '--accent-primary': '#e8a84c',
            '--accent-secondary': '#d4976a',
            '--accent-warning': '#e06050',
            '--accent-dim': 'rgba(232, 168, 76, 0.12)',
            '--border-color': '#3a352e',
        }
    },
    glacier: {
        label: 'Glacier',
        colors: {
            '--bg-primary': '#0a1215',
            '--bg-secondary': '#10191e',
            '--bg-card': '#152228',
            '--bg-elevated': '#1c2d35',
            '--text-primary': '#dceef5',
            '--text-secondary': '#7aabb8',
            '--text-muted': '#4a7580',
            '--accent-primary': '#22d3ee',
            '--accent-secondary': '#67e8f9',
            '--accent-warning': '#f472b6',
            '--accent-dim': 'rgba(34, 211, 238, 0.12)',
            '--border-color': '#1e3a45',
        }
    },
    whiteout: {
        label: 'Whiteout',
        colors: {
            '--bg-primary': '#fafafa',
            '--bg-secondary': '#ffffff',
            '--bg-card': '#ffffff',
            '--bg-elevated': '#f0f0f0',
            '--text-primary': '#111111',
            '--text-secondary': '#666666',
            '--text-muted': '#aaaaaa',
            '--accent-primary': '#111111',
            '--accent-secondary': '#444444',
            '--accent-warning': '#b91c1c',
            '--accent-dim': 'rgba(17, 17, 17, 0.08)',
            '--border-color': '#e0e0e0',
        }
    },
    sunset: {
        label: 'Sunset',
        colors: {
            '--bg-primary': '#1a0f10',
            '--bg-secondary': '#241518',
            '--bg-card': '#2e1a1e',
            '--bg-elevated': '#3a2228',
            '--text-primary': '#f5e0e4',
            '--text-secondary': '#b0808a',
            '--text-muted': '#704858',
            '--accent-primary': '#f97316',
            '--accent-secondary': '#fb923c',
            '--accent-warning': '#ef4444',
            '--accent-dim': 'rgba(249, 115, 22, 0.12)',
            '--border-color': '#4a2a32',
        }
    },
    evergreen: {
        label: 'Evergreen',
        colors: {
            '--bg-primary': '#0a120e',
            '--bg-secondary': '#101a14',
            '--bg-card': '#16221a',
            '--bg-elevated': '#1e2e24',
            '--text-primary': '#dceee4',
            '--text-secondary': '#7aaa90',
            '--text-muted': '#4a7560',
            '--accent-primary': '#34d399',
            '--accent-secondary': '#6ee7b7',
            '--accent-warning': '#f87171',
            '--accent-dim': 'rgba(52, 211, 153, 0.12)',
            '--border-color': '#1e3a2a',
        }
    }
};

const THEME_STORAGE_KEY = 'revy-theme';
const VALID_THEMES = Object.keys(THEMES);

function getStoredTheme() {
    try {
        const t = localStorage.getItem(THEME_STORAGE_KEY);
        return VALID_THEMES.includes(t) ? t : null;
    } catch { return null; }
}

function applyTheme(name) {
    if (!name || name === 'midnight') {
        document.documentElement.removeAttribute('data-theme');
    } else if (VALID_THEMES.includes(name)) {
        document.documentElement.dataset.theme = name;
    }
}

function setTheme(name) {
    applyTheme(name);
    try { localStorage.setItem(THEME_STORAGE_KEY, name); } catch {}
}

function clearTheme() {
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch {}
    document.documentElement.removeAttribute('data-theme');
}

async function syncThemeFromServer() {
    try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch('/api/user', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;
        const config = await res.json();
        const serverTheme = config.theme || 'midnight';
        const localTheme = getStoredTheme() || 'midnight';
        if (serverTheme !== localTheme) {
            setTheme(serverTheme);
        }
    } catch {}
}

// Apply immediately on script load (browser only)
if (typeof document !== 'undefined') {
    applyTheme(getStoredTheme());
}

// Allow Node.js require() for server-side validation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { THEMES, VALID_THEMES };
}
