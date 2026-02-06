// Clerk frontend authentication

const CLERK_PK = 'pk_test_ZGFyaW5nLXJlaW5kZWVyLTEwLmNsZXJrLmFjY291bnRzLmRldiQ';

let clerkReady = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://daring-reindeer-10.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.clerkPublishableKey = CLERK_PK;
    script.addEventListener('load', async () => {
        await window.Clerk.load();
        renderAuthUI(window.Clerk);
        if (window.Clerk.user && typeof syncThemeFromServer === 'function') {
            syncThemeFromServer();
        }
        resolve(window.Clerk);
    });
    script.addEventListener('error', () => {
        console.error('Failed to load Clerk SDK');
        resolve(null);
    });
    document.head.appendChild(script);
});

function renderAuthUI(clerk) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu || !clerk) return;

    // Show Settings link if signed in
    const settingsLink = navMenu.querySelector('.nav-link-auth');
    if (settingsLink && clerk.user) {
        settingsLink.style.display = '';
    }

    // Create auth container
    const authContainer = document.createElement('div');
    authContainer.className = 'nav-auth';
    navMenu.appendChild(authContainer);

    if (clerk.user) {
        const imageUrl = clerk.user.imageUrl;
        const initials = (clerk.user.firstName?.[0] || clerk.user.emailAddresses?.[0]?.emailAddress?.[0] || '?').toUpperCase();
        const avatarHtml = imageUrl
            ? `<img class="nav-avatar" src="${imageUrl}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'nav-avatar nav-avatar-fallback',textContent:'${initials}'}))">`
            : `<span class="nav-avatar nav-avatar-fallback">${initials}</span>`;
        authContainer.innerHTML = `
            <button class="nav-user-btn">${avatarHtml}</button>
            <div class="nav-user-dropdown">
                <a href="/settings.html" class="nav-dropdown-item">Settings</a>
                <button class="nav-dropdown-item nav-signout-btn">Sign Out</button>
            </div>
        `;
        const btn = authContainer.querySelector('.nav-user-btn');
        const dropdown = authContainer.querySelector('.nav-user-dropdown');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
            document.querySelector('.nav-dropdown-wrap')?.classList.remove('open');
        });
        authContainer.querySelector('.nav-signout-btn').addEventListener('click', async () => {
            if (typeof clearTheme === 'function') clearTheme();
            await clerk.signOut();
            window.location.href = '/';
        });
    } else {
        const signInLink = document.createElement('a');
        signInLink.href = '/sign-in.html';
        signInLink.className = 'nav-link';
        signInLink.textContent = 'Sign In';
        authContainer.appendChild(signInLink);
    }
}

async function isSignedIn() {
    const clerk = await clerkReady;
    return !!(clerk && clerk.user);
}

async function getAuthToken() {
    const clerk = await clerkReady;
    if (!clerk || !clerk.session) return null;
    return await clerk.session.getToken();
}

async function requireAuth(returnUrl) {
    const clerk = await clerkReady;
    if (!clerk || !clerk.user) {
        window.location.href = '/sign-in.html?redirect_url=' + encodeURIComponent(returnUrl || window.location.href);
        return false;
    }
    return true;
}
