import { useState, useEffect, useCallback } from 'react';
import type { BookInfo, JobInfo, LibraryItem } from '../services/api';
import { searchNovel, getBookDetail, createDownloadJob, getJobs, getLibrary, getDownloadUrl, getDownloadZipUrl } from '../services/api';
import { 
  Search, 
  Download, 
  BookOpen, 
  Star, 
  FileText,
  Loader2,
  CheckCircle,
  Bookmark,
  FolderOpen,
  Trash2,
  ExternalLink,
  XCircle,
  Clock,
  AlertCircle,
  FileDown,
} from 'lucide-react';
import './NovelDownloader.css';

const NovelDownloader = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'download' | 'library'>('search');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<BookInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryPath, setLibraryPath] = useState('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 搜索处理
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchNovel(searchKeyword);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索出错:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 选择书籍 -> 预览详情
  const handleSelectBook = async (book: BookInfo) => {
    setSelectedBook(book);
    setActiveTab('download');
    setSubmitState('idle');
    setSubmitMessage('');
    setJobId(null);
    setPreviewData(null);
    setIsLoadingPreview(true);
    try {
      const detail = await getBookDetail(book.bookId);
      if (detail) {
        setSelectedBook(detail);
        setPreviewData(detail);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 开始下载（提交任务到后端）
  const startDownload = async () => {
    if (!selectedBook) return;
    
    setSubmitState('submitting');
    setSubmitMessage('');
    
    try {
      const result = await createDownloadJob(selectedBook.bookId, {
        format: 'epub',
      });
      if (result) {
        setJobId(result.id);
        setSubmitState('done');
        setSubmitMessage(`✅ 下载任务已创建 (ID: ${result.id})，后端正在下载中...`);
      } else {
        setSubmitState('error');
        setSubmitMessage('❌ 创建下载任务失败，请检查后端服务是否运行');
      }
    } catch (e) {
      setSubmitState('error');
      setSubmitMessage('❌ 请求失败: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // 下载全部（全选模式）
  const startDownloadAll = async () => {
    await startDownload();
  };

  // 加载任务列表
  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const jobList = await getJobs();
      setJobs(jobList);
    } catch (e) {
      console.error('加载任务失败:', e);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  // 加载书架
  const loadLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const items = await getLibrary(libraryPath || undefined);
      setLibraryItems(items);
    } catch (e) {
      console.error('加载书架失败:', e);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [libraryPath]);

  // 切换标签时加载数据
  useEffect(() => {
    if (activeTab === 'library') {
      loadLibrary();
    }
    if (activeTab === 'download' && jobId) {
      // 如果有任务在跑，定期刷新
      const timer = setInterval(loadJobs, 3000);
      return () => clearInterval(timer);
    }
  }, [activeTab, jobId, loadJobs, loadLibrary]);

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  };

  // 状态徽标
  const stateBadge = (state: string) => {
    const colors: Record<string, string> = {
      queued: '#f59e0b',
      running: '#3b82f6',
      done: '#10b981',
      failed: '#ef4444',
      cancelled: '#6b7280',
    };
    const labels: Record<string, string> = {
      queued: '排队中',
      running: '下载中',
      done: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };
    return (
      <span style={{ color: colors[state] || '#6b7280', fontWeight: 600, fontSize: '0.85em' }}>
        {labels[state] || state}
      </span>
    );
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString('zh-CN', { hour12: false });
  };

  return (
    <div className="app-container">
      {/* 背景装饰 */}
      <div className="bg-decoration">
        <div className="bg-circle bg-circle-1"></div>
        <div className="bg-circle bg-circle-2"></div>
        <div className="bg-circle bg-circle-3"></div>
      </div>

      {/* 主容器 */}
      <div className="main-wrapper">
        {/* 侧边栏 */}
        <div className="sidebar glass animate-fade-in">
          <div className="sidebar-header">
            <div className="logo">
              <BookOpen size={28} />
              <span>小说下载器</span>
            </div>
          </div>
          
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={20} />
              <span>搜索小说</span>
            </button>
            <button 
              className={`nav-item ${activeTab === 'download' ? 'active' : ''}`}
              onClick={() => setActiveTab('download')}
            >
              <Download size={20} />
              <span>下载管理</span>
            </button>
            <button 
              className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <Bookmark size={20} />
              <span>我的书架</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="stats-card glass-card">
              <div className="stat-item">
                <span className="stat-value">{jobs.filter(j => j.state === 'done').length}</span>
                <span className="stat-label">已完成</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{jobs.filter(j => j.state === 'running' || j.state === 'queued').length}</span>
                <span className="stat-label">进行中</span>
              </div>
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="content-area">
          {/* ===== 搜索页 ===== */}
          {activeTab === 'search' && (
            <div key="search" className="search-view animate-fade-in">
              {/* 搜索栏 */}
              <div className="search-bar glass-card">
                <div className="search-input-wrapper">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    className="glass-input search-input"
                    placeholder="输入小说名称、作者或关键词搜索..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <button 
                  className="glass-button search-btn"
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  <span>搜索</span>
                </button>
              </div>

              {/* 搜索结果 */}
              <div className="search-results">
                {searchResults.length > 0 ? (
                  <div className="results-grid">
                    {searchResults.map((book, index) => (
                      <div
                        key={book.bookId}
                        className="book-card glass-card animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                        onClick={() => handleSelectBook(book)}
                      >
                        <div className="book-cover">
                          <img 
                            src={book.coverUrl} 
                            alt={book.bookName}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><rect fill="%23667eea" width="100" height="140"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="12">📚</text></svg>';
                            }}
                          />
                          <div className="book-status">{book.status}</div>
                        </div>
                        <div className="book-info">
                          <h3 className="book-title">{book.bookName}</h3>
                          <p className="book-author">{book.author}</p>
                          <div className="book-meta">
                            <span className="tag">{book.category}</span>
                            <span className="score">
                              <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                              {book.score}
                            </span>
                          </div>
                          <div className="book-stats">
                            <span>{formatNumber(book.wordCount)}字</span>
                            <span>{book.chapterCount}章</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state glass-card">
                    <BookOpen size={48} />
                    <p>输入关键词搜索小说</p>
                    <span>支持搜索小说名、作者名</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 下载页 ===== */}
          {activeTab === 'download' && (
            <div key="download" className="download-view animate-fade-in">
              {isLoadingPreview ? (
                <div className="loading-state glass-card">
                  <Loader2 size={32} className="animate-spin" />
                  <p>加载中...</p>
                </div>
              ) : selectedBook ? (
                <>
                  {/* 书籍信息 */}
                  <div className="book-detail glass-card">
                    <div className="detail-header">
                      <img 
                        src={selectedBook.coverUrl} 
                        alt={selectedBook.bookName}
                        className="detail-cover"
                      />
                      <div className="detail-info">
                        <h2>{selectedBook.bookName}</h2>
                        <p className="detail-author">作者：{selectedBook.author}</p>
                        <p className="detail-abstract">{selectedBook.abstract}</p>
                        <div className="detail-meta">
                          <span className="tag">{selectedBook.category}</span>
                          <span className="tag">{selectedBook.status}</span>
                          <span className="score">
                            <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                            {selectedBook.score}
                          </span>
                        </div>
                        <div className="detail-stats" style={{ marginTop: 8, fontSize: '0.9em', color: '#666' }}>
                          <span>{formatNumber(selectedBook.wordCount)}字 · </span>
                          <span>{selectedBook.chapterCount}章</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 下载操作区 */}
                  <div className="chapter-section glass-card">
                    <div className="chapter-header">
                      <h3>
                        <FileDown size={20} />
                        下载操作
                      </h3>
                      <div className="chapter-actions">
                        <button 
                          className="glass-button"
                          onClick={startDownloadAll}
                          disabled={submitState === 'submitting'}
                        >
                          {submitState === 'submitting' ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Download size={18} />
                          )}
                          <span>下载整本书</span>
                        </button>
                      </div>
                    </div>

                    {/* 提交状态 */}
                    {submitState !== 'idle' && (
                      <div className="download-progress">
                        <p style={{ 
                          padding: '12px 16px', 
                          borderRadius: 8,
                          background: submitState === 'done' ? '#ecfdf5' : submitState === 'error' ? '#fef2f2' : '#eff6ff',
                          color: submitState === 'done' ? '#065f46' : submitState === 'error' ? '#991b1b' : '#1e40af',
                        }}>
                          {submitMessage}
                        </p>
                        {jobId && (
                          <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button 
                              className="glass-button-secondary glass-button" 
                              onClick={() => { loadJobs(); }}
                              style={{ fontSize: '0.85em' }}
                            >
                              刷新任务状态
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 任务列表 */}
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Clock size={16} />
                        下载任务
                      </h4>
                      {isLoadingJobs ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : jobs.length === 0 ? (
                        <p style={{ color: '#999', fontSize: '0.9em' }}>暂无任务</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {jobs.slice(0, 10).map(job => (
                            <div key={job.id} className="glass-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95em' }}>{job.title}</div>
                                <div style={{ fontSize: '0.8em', color: '#888', marginTop: 2 }}>
                                  {job.author} · #{job.id}
                                </div>
                                {job.progress && (
                                  <div style={{ fontSize: '0.8em', color: '#555', marginTop: 4 }}>
                                    进度: {job.progress.savedChapters}/{job.progress.chapterTotal} 章
                                    ({job.progress.groupDone}/{job.progress.groupTotal} 组)
                                  </div>
                                )}
                                {job.message && (
                                  <div style={{ fontSize: '0.8em', color: '#ef4444', marginTop: 2 }}>{job.message}</div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                {stateBadge(job.state)}
                                <span style={{ fontSize: '0.75em', color: '#aaa' }}>{formatTime(job.createdMs)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state glass-card animate-fade-in">
                  <Download size={48} />
                  <p>请先搜索并选择小说</p>
                  <span>点击搜索结果中的小说开始下载</span>
                </div>
              )}
            </div>
          )}

          {/* ===== 书架页 ===== */}
          {activeTab === 'library' && (
            <div key="library" className="library-view animate-fade-in">
              <div className="search-bar glass-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <FolderOpen size={20} />
                  <span style={{ fontWeight: 600 }}>已下载文件</span>
                  <button 
                    className="glass-button-secondary glass-button" 
                    onClick={loadLibrary}
                    disabled={isLoadingLibrary}
                    style={{ marginLeft: 'auto' }}
                  >
                    {isLoadingLibrary ? <Loader2 size={16} className="animate-spin" /> : '刷新'}
                  </button>
                </div>
              </div>

              {libraryItems.length === 0 ? (
                <div className="empty-state glass-card">
                  <Bookmark size={48} />
                  <p>我的书架</p>
                  <span>下载的小说将保存在这里</span>
                  <p style={{ fontSize: '0.85em', color: '#999', marginTop: 8 }}>
                    下载完成后，返回此页面刷新即可看到文件
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {libraryItems.map((item, idx) => (
                    <div key={idx} className="glass-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {item.isDir ? '📁 ' : '📄 '}
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#888' }}>
                          {item.isDir ? '目录' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!item.isDir && (
                          <a 
                            href={getDownloadUrl(item.path)} 
                            target="_blank" 
                            rel="noreferrer"
                            className="glass-button-secondary glass-button"
                            style={{ fontSize: '0.85em', textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} />
                            下载
                          </a>
                        )}
                        {item.isDir && (
                          <button 
                            className="glass-button-secondary glass-button"
                            onClick={() => setLibraryPath(item.path)}
                            style={{ fontSize: '0.85em' }}
                          >
                            <FolderOpen size={14} />
                            打开
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovelDownloader;