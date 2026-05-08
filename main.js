// ── CONFIG ────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';

// ── STATE ─────────────────────────────────────────────────────────────
let token = localStorage.getItem('token') || null;
let userName = localStorage.getItem('userName') || '';
let userId = localStorage.getItem('userId') || '';
let editingId = null;
let deletingId = null;

// ── INIT ──────────────────────────────────────────────────────────────
(function init() {
    if (token) {
        showDashboard();
    } else {
        showAuth();
    }
})();

// ── AUTH SCREENS ──────────────────────────────────────────────────────
function showAuth() {
    document.getElementById('auth-section').classList.add('active');
    document.getElementById('dashboard-section').classList.remove('active');
}

function showDashboard() {
    document.getElementById('auth-section').classList.remove('active');
    document.getElementById('dashboard-section').classList.add('active');
    document.getElementById('nav-user-name').textContent = userName || 'User';
    loadPosts();
}

function switchTab(tab) {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');
    clearMsg('login-error');
    clearMsg('register-error');
    clearMsg('register-success');

    document.getElementById(`${tab}-form`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

// ── LOGIN ─────────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    setLoading(btn, true);
    clearMsg('login-error');

    try {
        const res = await fetch(`${API_BASE}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Login failed');

        saveSession(data.token, data.result.name, data.result.email);
        showDashboard();
    } catch (err) {
        showMsg('login-error', err.message);
    } finally {
        setLoading(btn, false);
    }
}

// ── REGISTER ──────────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;
    const btn = document.getElementById('register-btn');

    setLoading(btn, true);
    clearMsg('register-error');
    clearMsg('register-success');

    try {
        const res = await fetch(`${API_BASE}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, confirmPassword })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Registration failed');

        showMsg('register-success', 'Account created! You can now sign in.', false);
        document.getElementById('register-form').reset();
        setTimeout(() => switchTab('login'), 1800);
    } catch (err) {
        showMsg('register-error', err.message);
    } finally {
        setLoading(btn, false);
    }
}

// ── SESSION ───────────────────────────────────────────────────────────
function saveSession(tok, name, email) {
    token = tok;
    userName = name;

    // Decode userId from JWT payload
    try {
        const payload = JSON.parse(atob(tok.split('.')[1]));
        userId = payload.id;
        localStorage.setItem('userId', userId);
    } catch (_) { }

    localStorage.setItem('token', tok);
    localStorage.setItem('userName', name);
}

function handleLogout() {
    token = userName = userId = null;
    localStorage.clear();
    showAuth();
    showToast('Signed out', 'success');
}

// ── POSTS ─────────────────────────────────────────────────────────────
async function loadPosts() {
    const grid = document.getElementById('posts-grid');
    const loader = document.getElementById('posts-loader');
    const empty = document.getElementById('posts-empty');

    grid.innerHTML = '';
    loader.classList.remove('hidden');
    empty.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/posts`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        const posts = data.result;
        loader.classList.add('hidden');

        document.getElementById('post-count-label').textContent =
            posts.length === 0 ? 'No posts yet' : `${posts.length} post${posts.length !== 1 ? 's' : ''}`;

        if (posts.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        posts.slice().reverse().forEach((post, i) => {
            const card = buildCard(post, i);
            grid.appendChild(card);
        });

    } catch (err) {
        loader.classList.add('hidden');
        showToast(err.message || 'Failed to load posts', 'error');
    }
}

function buildCard(post, index) {
    const isOwner = userId && post.creator === userId;
    const date = post.createdAt
        ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    const card = document.createElement('div');
    card.className = 'post-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.innerHTML = `
    <div class="post-title">${escHtml(post.title)}</div>
    ${post.content ? `<div class="post-content">${escHtml(post.content)}</div>` : ''}
    <div class="post-meta">${date}</div>
    ${isOwner ? `
      <div class="post-actions">
        <button class="btn-edit" onclick="openEditModal('${post._id}', ${JSON.stringify(escHtml(post.title))}, ${JSON.stringify(escHtml(post.content || ''))})">Edit</button>
        <button class="btn-del"  onclick="openDeleteModal('${post._id}')">Delete</button>
      </div>` : ''}
  `;
    return card;
}

// ── CREATE / EDIT POST ────────────────────────────────────────────────
function openModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'New Post';
    document.getElementById('post-submit-label').textContent = 'Publish';
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    clearMsg('post-error');
    document.getElementById('post-modal').classList.remove('hidden');
}

function openEditModal(id, title, content) {
    editingId = id;
    document.getElementById('modal-title').textContent = 'Edit Post';
    document.getElementById('post-submit-label').textContent = 'Save Changes';
    document.getElementById('post-title').value = title;
    document.getElementById('post-content').value = content;
    clearMsg('post-error');
    document.getElementById('post-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('post-modal').classList.add('hidden');
}

function closeModalOutside(e) {
    if (e.target.id === 'post-modal') closeModal();
}

async function handlePostSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const btn = document.getElementById('post-submit-btn');

    setLoading(btn, true);
    clearMsg('post-error');

    try {
        const url = editingId ? `${API_BASE}/posts/${editingId}` : `${API_BASE}/posts`;
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, content })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Request failed');

        closeModal();
        showToast(editingId ? 'Post updated!' : 'Post published!', 'success');
        loadPosts();
    } catch (err) {
        showMsg('post-error', err.message);
    } finally {
        setLoading(btn, false);
    }
}

// ── DELETE POST ───────────────────────────────────────────────────────
function openDeleteModal(id) {
    deletingId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    deletingId = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

function closeDeleteOutside(e) {
    if (e.target.id === 'delete-modal') closeDeleteModal();
}

async function confirmDelete() {
    if (!deletingId) return;
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    try {
        const res = await fetch(`${API_BASE}/posts/${deletingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Delete failed');

        closeDeleteModal();
        showToast('Post deleted', 'success');
        loadPosts();
    } catch (err) {
        showToast(err.message, 'error');
        closeDeleteModal();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Delete';
    }
}

// ── HELPERS ───────────────────────────────────────────────────────────
function setLoading(btn, on) {
    const span = btn.querySelector('span');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = on;
    if (span) span.classList.toggle('hidden', on);
    if (loader) loader.classList.toggle('hidden', !on);
}

function showMsg(id, msg, isError = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden', 'error', 'success');
    el.classList.add(isError ? 'error' : 'success');
}

function clearMsg(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast t-${type}`;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.classList.add('hidden'), 350);
    }, 2800);
}
