// 番茄小说下载器 - 对接本地后端服务
// 后端地址（本地运行的服务，修改为你的实际地址）
const API_BASE = 'http://127.0.0.1:18423';

// ========== 类型定义 ==========

export interface BookInfo {
  bookId: string;
  bookName: string;
  author: string;
  coverUrl: string;
  abstract: string;
  chapterCount: number;
  wordCount: number;
  category: string;
  score: number;
  status: string;
}

export interface JobInfo {
  id: number;
  bookId: string;
  title: string;
  author: string;
  state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  message: string | null;
  progress: {
    savedChapters: number;
    chapterTotal: number;
    groupDone: number;
    groupTotal: number;
    savePhase: string;
  } | null;
  createdMs: number;
  updatedMs: number;
}

export interface LibraryItem {
  name: string;
  isDir: boolean;
  path: string;
  size: number;
  modified: number;
}

// ========== 原始 API 数据解析 ==========

function parseBookFromPreview(data: any): BookInfo {
  return {
    bookId: data.book_id || '',
    bookName: data.book_name || '',
    author: data.author || '未知作者',
    coverUrl: data.cover_url 
      ? `${API_BASE}${data.cover_url}`
      : (data.detail_cover_url ? `${API_BASE}${data.detail_cover_url}` : ''),
    abstract: data.description || '暂无简介',
    chapterCount: data.chapter_count || 0,
    wordCount: data.word_count || 0,
    category: data.category || '未分类',
    score: data.score || 0,
    status: data.finished === true ? '已完结' : (data.finished === false ? '连载中' : '未知'),
  };
}

function parseBookFromSearch(item: any): BookInfo {
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

// ========== API 函数 ==========

/** 搜索小说 */
export async function searchNovel(keyword: string): Promise<BookInfo[]> {
  if (!keyword.trim()) return [];
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || data || [];
    return Array.isArray(items) ? items.map(parseBookFromSearch) : [];
  } catch (e) {
    console.error('搜索失败:', e);
    return [];
  }
}

/** 获取书籍详情（预览） */
export async function getBookDetail(bookId: string): Promise<BookInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/preview/${encodeURIComponent(bookId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseBookFromPreview(data);
  } catch (e) {
    console.error('获取书籍详情失败:', e);
    return null;
  }
}

/** 创建下载任务 */
export async function createDownloadJob(
  bookId: string,
  options?: { rangeStart?: number; rangeEnd?: number; format?: string }
): Promise<{ id: number; state: string } | null> {
  try {
    const body: any = { book_id: bookId };
    if (options?.rangeStart) body.range_start = options.rangeStart;
    if (options?.rangeEnd) body.range_end = options.rangeEnd;
    if (options?.format) body.novel_format = options.format;
    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('创建下载任务失败:', e);
    return null;
  }
}

/** 获取所有任务 */
export async function getJobs(): Promise<JobInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];
    return items.map(mapJob);
  } catch (e) {
    console.error('获取任务列表失败:', e);
    return [];
  }
}

/** 获取单个任务 */
export async function getJobById(id: number): Promise<JobInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs?id=${encodeURIComponent(String(id))}`);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.items || [];
    return items.length > 0 ? mapJob(items[0]) : null;
  } catch (e) {
    console.error('获取任务失败:', e);
    return null;
  }
}

/** 删除任务 */
export async function deleteJob(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 取消任务 */
export async function cancelJob(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(String(id))}/cancel`, {
      method: 'POST',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ========== 内部辅助 ==========

function mapJob(item: any): JobInfo {
  return {
    id: item.id,
    bookId: item.book_id || '',
    title: item.title || '',
    author: item.author || '',
    state: item.state || 'unknown',
    message: item.message || null,
    progress: item.progress ? {
      savedChapters: item.progress.saved_chapters || 0,
      chapterTotal: item.progress.chapter_total || 0,
      groupDone: item.progress.group_done || 0,
      groupTotal: item.progress.group_total || 0,
      savePhase: item.progress.save_phase || '',
    } : null,
    createdMs: item.created_ms || 0,
    updatedMs: item.updated_ms || 0,
  };
}

/** 获取服务状态 */
export async function getServerStatus(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 获取配置 */
export async function getConfig(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/config/full`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 获取已下载文件列表（图书馆） */
export async function getLibrary(path?: string): Promise<LibraryItem[]> {
  try {
    const url = path
      ? `${API_BASE}/api/library?path=${encodeURIComponent(path)}`
      : `${API_BASE}/api/library`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      name: item.name || '',
      isDir: item.is_dir || false,
      path: item.rel_path || item.path || '',
      size: item.size || 0,
      modified: item.modified || 0,
    }));
  } catch {
    return [];
  }
}

/** 获取下载文件的链接 */
export function getDownloadUrl(relPath: string): string {
  return `${API_BASE}/download/${encodeURIComponent(relPath)}`;
}

/** 获取下载 zip 的链接 */
export function getDownloadZipUrl(relPath: string): string {
  return `${API_BASE}/download-zip/${encodeURIComponent(relPath)}`;
}