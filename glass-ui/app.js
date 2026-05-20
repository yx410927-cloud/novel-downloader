// ===== 番茄小说液态玻璃 UI - 对接本地后端 =====

const API_BASE = 'http://127.0.0.1:18423';

// DOM 元素
const $ = id => document.getElementById(id);
const elements = {
    searchInput: $('searchInput'),
    searchBtn: $('searchBtn'),
    results: $('results'),
    loading: $('loading'),
    bookDetail: $('bookDetail'),
    detailContent: $('detailContent'),
    closeDetail: $('closeDetail'),
    toast: $('toast'),
    tags: document.querySelectorAll('.tag'),
};

// ===== 初始化 =====
function init() {
    bindEvents();
    showToast('✨ 番茄小说下载器已就绪');
    checkServerStatus();
}

function bindEvents() {
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.tags.forEach(tag => {
        tag.addEventListener('click', () => {
            elements.searchInput.value = tag.dataset.keyword;
            handleSearch();
        });
    });
    elements.closeDetail.addEventListener('click', closeDetail);
    elements.bookDetail.addEventListener('click', (e) => {
        if (e.target === elements.bookDetail) closeDetail();
    });
}

// ===== 后端状态检测 =====
async function checkServerStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
            const data = await res.json();
            showToast(`✅ 服务已就绪 v${data.version}`);
        }
    } catch {
        showToast('⚠️ 后端服务未连接，请确保服务已启动');
    }
}

// ===== 搜索 =====
async function handleSearch() {
    const keyword = elements.searchInput.value.trim();
    if (!keyword) { showToast('请输入搜索关键词'); return; }
    
    showLoading(true);
    try {
        const results = await searchNovel(keyword);
        renderResults(results);
    } catch (error) {
        console.error('搜索失败:', error);
        showToast('搜索失败，请检查后端服务');
    } finally {
        showLoading(false);
    }
}

async function searchNovel(keyword) {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    const items = data.items || data || [];
    return Array.isArray(items) ? items.map(parseBook) : [];
}

function parseBook(item) {
    const raw = item.raw || item;
    return {
        bookId: raw.book_id || '',
        bookName: raw.book_name || '',
        author: raw.author || '未知作者',
        coverUrl: raw.cover_url || raw.thumb_url || '',
        abstract: raw.abstract || raw.book_abstract_v2 || '暂无简介',
        chapterCount: parseInt(raw.chapter_number || '0', 10),
        wordCount: parseInt(raw.word_count || '0', 10),
        category: raw.category || '未分类',
        score: raw.score || 0,
        status: raw.creation_status === 2 ? '已完结' : '连载中',
    };
}

// ===== 渲染搜索结果 =====
function renderResults(books) {
    if (!books || books.length === 0) {
        elements.results.innerHTML = `
            <div class="glass-card" style="text-align:center;padding:40px;">
                <p style="color:rgba(255,255,255,0.7);">未找到相关书籍</p>
            </div>
        `;
        return;
    }
    
    elements.results.innerHTML = books.map((book, i) => `
        <div class="glass-card book-card" data-id="${book.bookId}" style="animation-delay:${i*0.05}s">
            <img src="${book.coverUrl}" 
                 alt="${book.bookName}" 
                 class="book-cover"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 110%22><rect fill=%22667eea%22 width=%2280%22 height=%22110%22/><text x=%2240%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2220%22>📚</text></svg>'">
            <div class="book-info">
                <div>
                    <h3 class="book-title">${book.bookName}</h3>
                    <p class="book-author">${book.author}</p>
                </div>
                <div class="book-meta">
                    <span class="book-score">⭐ ${book.score || '?'}</span>
                    <span class="book-category">${book.category}</span>
                    <span class="book-status ${book.status === '已完结' ? 'status-complete' : 'status-ongoing'}">
                        ${book.status}
                    </span>
                </div>
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">
                    ${fmtNum(book.chapterCount)}章 · ${fmtNum(book.wordCount)}字
                </div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', () => showBookDetail(card.dataset.id));
    });
}

// ===== 书籍详情 =====
async function showBookDetail(bookId) {
    showToast('⏳ 加载详情中...');
    try {
        const res = await fetch(`${API_BASE}/api/preview/${encodeURIComponent(bookId)}`);
        if (!res.ok) throw new Error('获取详情失败');
        const data = await res.json();
        renderDetail(data);
        elements.bookDetail.classList.remove('hidden');
    } catch (error) {
        showToast('❌ 获取详情失败');
    }
}

function renderDetail(book) {
    const coverUrl = book.cover_url 
        ? `${API_BASE}${book.cover_url}`
        : (book.detail_cover_url ? `${API_BASE}${book.detail_cover_url}` : '');
    
    elements.detailContent.innerHTML = `
        <div class="detail-header">
            <img src="${coverUrl}" 
                 alt="${book.book_name}" 
                 class="detail-cover"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 160%22><rect fill=%22667eea%22 width=%22120%22 height=%22160%22/><text x=%2260%22 y=%2280%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2230%22>📚</text></svg>'">
            <div class="detail-info">
                <h2>${book.book_name || '未知'}</h2>
                <p>${book.author || '未知作者'} · ${book.category || '未分类'}</p>
                <div class="detail-stats">
                    <div class="stat-item">
                        <span class="stat-value">${book.score || '?'}</span>
                        <span class="stat-label">评分</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${fmtNum(book.chapter_count)}</span>
                        <span class="stat-label">章节</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${fmtNum(book.word_count)}</span>
                        <span class="stat-label">字数</span>
                    </div>
                </div>
                <div style="margin-top:8px;">
                    <span class="book-status ${book.finished === true ? 'status-complete' : 'status-ongoing'}">
                        ${book.finished === true ? '已完结' : (book.finished === false ? '连载中' : '未知')}
                    </span>
                    ${book.read_count_text ? `<span style="font-size:12px;color:rgba(255,255,255,0.5);margin-left:8px;">${book.read_count_text}</span>` : ''}
                </div>
            </div>
        </div>
        <div class="detail-abstract">
            ${book.description || '暂无简介'}
        </div>
        ${book.tags && book.tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
            ${book.tags.map(t => `<span style="padding:4px 12px;background:rgba(255,255,255,0.1);border-radius:12px;font-size:12px;">${t}</span>`).join('')}
        </div>` : ''}
        ${book.first_chapter_title ? `<div class="detail-chapter-range" style="padding:12px;background:rgba(255,255,255,0.08);border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.6;">
            <div><span style="opacity:0.6;">首章：</span>${book.first_chapter_title}</div>
            <div><span style="opacity:0.6;">末章：</span>${book.last_chapter_title || '—'}</div>
        </div>` : ''}
        <div class="action-btns">
            <button class="glass-btn primary" onclick="startDownload('${book.book_id}')">
                📥 下载整本
            </button>
        </div>
    `;
}

function closeDetail() {
    elements.bookDetail.classList.add('hidden');
}

// ===== 下载 =====
async function startDownload(bookId) {
    showToast('🚀 创建下载任务...');
    try {
        const res = await fetch(`${API_BASE}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: bookId }),
        });
        if (!res.ok) throw new Error('请求失败');
        const job = await res.json();
        showToast(`✅ 任务已创建 (ID: ${job.id})，后台下载中`);
    } catch (error) {
        showToast('❌ 下载失败: ' + error.message);
    }
}

// ===== UI 辅助 =====
function showLoading(show) {
    elements.loading.classList.toggle('hidden', !show);
    elements.results.style.display = show ? 'none' : '';
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function fmtNum(num) {
    if (!num) return '0';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toString();
}

// 启动
init();