// Shared navigation web component — <snow-nav></snow-nav>
class SnowNav extends HTMLElement {
    connectedCallback() {
        this.setAttribute('role', 'navigation');
        this.className = 'top-nav';
        this.innerHTML = `
            <a href="/" class="nav-brand">
                <svg class="nav-logo" viewBox="0 0 100 100">
                    <g stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round">
                        <line x1="50" y1="10" x2="50" y2="90" />
                        <line x1="10" y1="50" x2="90" y2="50" />
                        <line x1="21" y1="21" x2="79" y2="79" />
                        <line x1="79" y1="21" x2="21" y2="79" />
                        <line x1="50" y1="20" x2="40" y2="30" />
                        <line x1="50" y1="20" x2="60" y2="30" />
                        <line x1="50" y1="80" x2="40" y2="70" />
                        <line x1="50" y1="80" x2="60" y2="70" />
                    </g>
                </svg>
                <span class="nav-title">Truflake</span>
            </a>
            <div class="nav-menu">
                <div class="nav-dropdown-wrap">
                    <button class="nav-link nav-pro-btn">Pro</button>
                    <div class="nav-pro-dropdown">
                        <a href="/tv.html" class="nav-dropdown-item">TV Mode</a>
                        <a href="/calendar.html" class="nav-dropdown-item">Yearly Stats</a>
                    </div>
                </div>
                <a href="/about.html" class="nav-link">About</a>
                <a href="/settings.html" class="nav-link nav-link-auth" style="display:none">Settings</a>
            </div>
        `;

        const proBtn = this.querySelector('.nav-pro-btn');
        const wrap = this.querySelector('.nav-dropdown-wrap');
        if (proBtn && wrap) {
            proBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                wrap.classList.toggle('open');
            });
            document.addEventListener('click', () => wrap.classList.remove('open'));
        }
    }
}

customElements.define('snow-nav', SnowNav);
