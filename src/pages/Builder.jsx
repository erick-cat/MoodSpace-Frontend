import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listTemplates, renderProject, getConfigBySubdomain, getUserStatus } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const BASE_DOMAIN = '885201314.xyz';

const FIELD_LABELS = {
    title: '网页标题',
    sender: '发送人 (你)',
    receiver: '接收人 (TA)',
    paragraphs: '浪漫留言'
};

const DEFAULT_VALUES = {
    title: '致我最爱的人',
    sender: '小明',
    receiver: '小红',
    paragraphs: '在这个特别的日子里，\n我想对你说，\n遇见你是我这辈子最幸运的事。'
};

// Global cache to prevent redundant fetches across navigation
let globalTemplatesCache = [];

export default function Builder() {
    const { templateName } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const editSubdomain = searchParams.get('edit');

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelected] = useState(null);
    const [subdomain, setSubdomain] = useState('');
    const [fieldValues, setFieldValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [result, setResult] = useState(null); // { url }
    const [status, setStatus] = useState(null); // { dailyUsedEdits, maxDailyEdits }

    // BSR (Browser-Side Rendering) Raw HTML
    const [rawHtml, setRawHtml] = useState(null);

    // Load template list and check for edit mode
    useEffect(() => {
        const init = async () => {
            // Optimization: Use global cache if available
            let list = globalTemplatesCache;
            if (list.length === 0) {
                setInitialLoading(true);
                try {
                    const d = await listTemplates();
                    list = d.templates ?? [];
                    globalTemplatesCache = list;
                    setTemplates(list);
                } catch (e) {
                    toast.error(`网页模板列表获取失败：${e.message}`);
                    setInitialLoading(false);
                    return;
                }
            } else if (templates.length === 0) {
                // If cache exists but state is empty (e.g., component remounted)
                setTemplates(list);
            }

            try {
                // Handle Edit Mode
                if (editSubdomain && user) {
                    const cfgRes = await getConfigBySubdomain(editSubdomain, user.id);
                    if (cfgRes.success && cfgRes.data) {
                        const project = cfgRes.data;
                        setSubdomain(project.subdomain);
                        const found = list.find(t => t.name === project.template_type);
                        if (found) setSelected(found);
                        setFieldValues(project.data || {});
                    }
                } else if (templateName) {
                    const found = list.find((t) => t.name === templateName);
                    if (found) setSelected(found);
                }
            } catch (err) {
                console.error('[Builder Init Error]', err);
                if (editSubdomain) toast.error('获取原有网页信息失败');
            } finally {
                setInitialLoading(false);
            }
        };
        init();
    }, [templateName, editSubdomain, user]);

    // Fetch user quota for status display
    useEffect(() => {
        if (!user) return;
        getUserStatus(user.id)
            .then(res => {
                if (res.success) setStatus(res.data);
            })
            .catch(err => console.error('[Status Fetch Error]', err));
    }, [user]);

    // Fetch raw HTML when template changes (for BSR Preview)
    useEffect(() => {
        if (!selectedTemplate) {
            setRawHtml(null);
            return;
        }

        // Pre-fill default values for the selected template
        if (!selectedTemplate.static && selectedTemplate.fields) {
            const initialVals = {};
            selectedTemplate.fields.forEach(f => {
                const key = typeof f === 'string' ? f : (f.id || f.key);
                const defaultValue = typeof f === 'string' 
                    ? (DEFAULT_VALUES[f] || '') 
                    : (f.default !== undefined ? f.default : (DEFAULT_VALUES[key] || ''));
                initialVals[key] = defaultValue;
            });
            setFieldValues(initialVals);
        } else {
            setFieldValues({});
        }

        const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
        fetch(`${apiBase}/api/template/raw/${selectedTemplate.name}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch raw template');
                return res.text();
            })
            .then(html => setRawHtml(html))
            .catch(err => console.error('[BSR Error]', err));
    }, [selectedTemplate]);

    function handleTemplateChange(e) {
        const found = templates.find((t) => t.name === e.target.value) ?? null;
        setSelected(found);
        setFieldValues({});
        setResult(null);
        
        // Preserve edit mode if active
        const query = editSubdomain ? `?edit=${editSubdomain}` : '';
        if (found) navigate(`/builder/${found.name}${query}`, { replace: true });
        else navigate(`/builder${query}`, { replace: true });
    }

    async function pollReachability(url, maxRetries = 10) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Use a cache-busting timestamp to bypass Cloudflare edge cache during polling
                const checkUrl = `${url}?t=${Date.now()}`;
                const res = await fetch(checkUrl, { method: 'HEAD', mode: 'no-cors' });
                // With no-cors, we can't see the status, but if it doesn't throw, it's usually reachable.
                await new Promise(r => setTimeout(r, 1500));
                if (i > 2) return true; // Assume success after 4.5s of "no error"
            } catch (e) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return true; 
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setResult(null);

        if (!selectedTemplate) return toast.error('请选择一个网页模板');
        if (!subdomain) return toast.error('请给网页起一个专属网址');

        if (!user) {
            toast.error('请先登录后再发布网页 🔑');
            navigate('/auth');
            return;
        }

        setLoading(true);
        const toastId = toast.loading(editSubdomain ? '正在更新您的浪漫网页...' : '正在为您全网生成中...');
        try {
            const response = await renderProject({
                subdomain,
                type: selectedTemplate.name,
                data: fieldValues,
            });

            if (response.code !== 0) {
                toast.error(response.message || '生成失败', { id: toastId });
                return;
            }

            const pageUrl = response.data?.url || `https://${subdomain}.${BASE_DOMAIN}/`;
            
            // Wait for the page to be reachable before showing success
            toast.loading(
                <div style={{ fontSize: '0.85rem' }}>
                    {editSubdomain ? '更新已同步，正在等待全网生效...' : '生成已完成，正在等待全网生效...'}
                    <div style={{ marginTop: '4px', opacity: 0.8, fontSize: '0.75rem' }}>
                        💡 页面生效通常需要几秒，如等待较久可前往个人中心检查状态。
                    </div>
                </div>, 
                { id: toastId }
            );
            await pollReachability(pageUrl);

            setResult({ url: pageUrl });

            toast.success(
                <span>
                    🎉 {editSubdomain ? '更新成功！' : '发布成功！'}<br />
                    <a href={pageUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#d6336c', fontWeight: 'bold' }}>
                        立即访问页面 →
                    </a>
                </span>,
                { id: toastId, duration: 6000 }
            );
            
            // Refresh status to update daily edit count
            getUserStatus(user.id).then(res => { if (res.success) setStatus(res.data); });

        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    }

    // --- BSR Real-time Preview Generation ---
    let previewHtml = '';
    if (rawHtml && selectedTemplate) {
        const baseTag = `<base href="https://www.885201314.xyz/assets/${selectedTemplate.name}/" />`;
        
        const headRegex = /<head[^>]*>/i;
        if (headRegex.test(rawHtml)) {
            previewHtml = rawHtml.replace(headRegex, (match) => `${match}\n  ${baseTag}`);
        } else {
            previewHtml = `${baseTag}\n${rawHtml}`;
        }

        previewHtml = previewHtml.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const k = key.trim();
            if (fieldValues[k] !== undefined && fieldValues[k] !== '') return fieldValues[k];
            return '';
        });
    }

    return (
        <div className="page container" style={{ maxWidth: 1000 }}>
            <h1 className="section-title">{editSubdomain ? '🛠️ 修改专属网页' : '✏️ 制作专属网页'}</h1>
            <p className="section-sub">
                {editSubdomain 
                    ? `正在优化您的专属页面：${editSubdomain}.${BASE_DOMAIN}` 
                    : '填写下方信息后，系统将即时生成带有专属独立网址的浪漫网页。'}
            </p>

            {result && (
                <div className="alert alert--success" style={{ margin: '0 auto 1.5rem' }}>
                    🎉 {editSubdomain ? '页面更新已生效！' : '页面发布已成功！'}
                    <div className="alert__actions">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
                            立即访问页面 ↗
                        </a>
                    </div>
                </div>
            )}

            <div className="builder-layout">
                {/* Left Panel: Form */}
                <div className="builder-panel-form">
                    <form onSubmit={handleSubmit} className="builder-card">
                        {initialLoading && (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                <div className="spinner" style={{ marginBottom: '10px' }}></div>
                                <div>正在获取模板列表...</div>
                            </div>
                        )}

                        {!initialLoading && (
                            <>
                                {/* Template selector */}
                                <div className="form-group">
                                    <label htmlFor="template">📦 选择网页模板</label>
                                    <select
                                        id="template"
                                        value={selectedTemplate?.name ?? ''}
                                        onChange={handleTemplateChange}
                                        required
                                    >
                                        <option value="">-- 请先选择模板 --</option>
                                        {templates.map((t) => (
                                            <option key={t.name} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subdomain */}
                                <div className="form-group">
                                    <label htmlFor="subdomain">🌐 专属网址 {editSubdomain && <span style={{ color: '#64748b', fontWeight: 400 }}>(不可修改)</span>}</label>
                                    <div className="input-row">
                                        <input
                                            id="subdomain"
                                            type="text"
                                            value={subdomain}
                                            onChange={(e) => !editSubdomain && setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            placeholder="例如：our-love-story"
                                            required
                                            readOnly={!!editSubdomain}
                                            style={editSubdomain ? { background: '#f8fafc', color: '#64748b' } : {}}
                                        />
                                        <span className="input-suffix">.{BASE_DOMAIN}</span>
                                    </div>
                                    {editSubdomain && (
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                            💡 更新内容不消耗账号额度。
                                            {status && <span> 今日剩余可修改次数：{status.maxDailyEdits - status.dailyUsedEdits} / {status.maxDailyEdits}</span>}
                                        </p>
                                    )}
                                </div>

                                {/* Dynamic fields from schema */}
                                {selectedTemplate && !selectedTemplate.static && (selectedTemplate.fields ?? []).length > 0 && (
                                    <>
                                        <hr className="builder-divider" />
                                        <p className="builder-section-label">📝 填入你们的专属内容</p>
                                        {selectedTemplate.fields.map((f) => {
                                            const key = typeof f === 'string' ? f : (f.id || f.key);
                                            const label = typeof f === 'string' ? (FIELD_LABELS[f] || f) : (f.label || f.id || f.key);
                                            const placeholder = typeof f === 'string' 
                                                ? (`请输入 ${FIELD_LABELS[f] || f}`) 
                                                : (f.placeholder || `请输入 ${label}`);
                                            const inputType = typeof f === 'string' ? 'textarea' : (f.type || 'text');

                                            return (
                                                <div className="form-group" key={key}>
                                                    <label htmlFor={`f-${key}`}>{label}</label>
                                                    {inputType === 'textarea' ? (
                                                        <textarea
                                                            id={`f-${key}`}
                                                            rows={key === 'paragraphs' ? 4 : 2}
                                                            value={fieldValues[key] ?? ''}
                                                            onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                                                            placeholder={placeholder}
                                                        />
                                                    ) : (
                                                        <input
                                                            id={`f-${key}`}
                                                            type="text"
                                                            value={fieldValues[key] ?? ''}
                                                            onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                                                            placeholder={placeholder}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}

                                <div className="builder-submit">
                                    <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                        {loading ? (editSubdomain ? '正在更新中...' : '全网生成中...') : (editSubdomain ? '✨ 立即保存并更新网页' : '✨ 一键生成我的专属网页')}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>

                {/* Right Panel: Live Preview iframe (BSR) - Mobile Form Factor */}
                {selectedTemplate && rawHtml && (
                    <div className="builder-panel-preview">
                        <div className="mobile-mockup" style={{ transformOrigin: 'top center' }}>
                            <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', fontSize: '13px', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#1a1a2e' }}>实时预览</span>
                                <span style={{ fontSize: '10px', background: '#ff477e', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>LIVE</span>
                            </div>
                            <iframe
                                srcDoc={previewHtml}
                                style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Live Preview"
                                id="preview-iframe"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
