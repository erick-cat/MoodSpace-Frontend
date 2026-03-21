import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listTemplates, renderProject, getConfigBySubdomain, getUserStatus, checkDomainAvailability } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'moodspace.xyz';

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
    const [showViralFooter, setShowViralFooter] = useState(true);

    // BSR (Browser-Side Rendering) Raw HTML
    const [rawHtml, setRawHtml] = useState(null);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);

    // Domain Checker State
    const [domainStatus, setDomainStatus] = useState('idle'); // idle, checking, available, taken, error
    const [domainMsg, setDomainMsg] = useState('');

    // 0. Domain Availability Checker (Debounced)
    useEffect(() => {
        if (editSubdomain || !subdomain) {
            setDomainStatus('idle');
            setDomainMsg('');
            return;
        }

        const minLen = status?.minDomainLen ?? 3;
        if (subdomain.length < minLen) {
            setDomainStatus('error');
            setDomainMsg(`⚠️ 域名太短，您的等级至少需要 ${minLen} 个字符`);
            return;
        }

        setDomainStatus('checking');
        setDomainMsg('正在实时检测可用性...');

        const timer = setTimeout(() => {
            checkDomainAvailability(subdomain)
                .then(res => {
                    if (res.available) {
                        setDomainStatus('available');
                        setDomainMsg(res.message);
                    } else {
                        setDomainStatus('taken');
                        setDomainMsg(`❌ ${res.message}`);
                    }
                })
                .catch(err => {
                    setDomainStatus('error');
                    setDomainMsg('⚠️ 检测网络异常，请重试');
                });
        }, 1000); // 1-second debounce

        return () => clearTimeout(timer);
    }, [subdomain, editSubdomain, status]);

    // 1. Persistence for referral code (Runs once)
    useEffect(() => {
        const urlRef = searchParams.get('ref');
        if (urlRef) {
            localStorage.setItem('rs_ref', JSON.stringify({ code: urlRef, time: Date.now() }));
        }
    }, [searchParams]);

    // 2. Load template list (Runs once)
    useEffect(() => {
        listTemplates().then(d => {
            setTemplates(d.templates ?? []);
            setInitialLoading(false);
        }).catch(e => {
            console.error('[Templates Fetch Error]', e);
            toast.error('获取模板列表失败');
            setInitialLoading(false);
        });
    }, []);

    // 3. Handle Edit Mode Data (Runs once when user/subdomain available)
    useEffect(() => {
        if (editSubdomain && user && !initialDataLoaded) {
            getConfigBySubdomain(editSubdomain, user.id).then(cfgRes => {
                if (cfgRes.success && cfgRes.data) {
                    const project = cfgRes.data;
                    setSubdomain(project.subdomain);
                    // Field values and footer
                    setFieldValues(project.data || {});
                    setShowViralFooter(project.show_viral_footer !== false);

                    // Template selection
                    if (templates.length > 0) {
                        const found = templates.find(t => t.name === project.template_type);
                        if (found) setSelected(found);
                    }
                    setInitialDataLoaded(true);
                }
            }).catch(e => console.error('[Edit Data Error]', e));
        }
    }, [editSubdomain, user, templates, initialDataLoaded]);

    // 4. Handle initial template choice from URL (New Page Flow)
    useEffect(() => {
        if (!editSubdomain && templateName && templates.length > 0 && !selectedTemplate) {
            const found = templates.find(t => t.name === templateName);
            if (found) setSelected(found);
        }
    }, [templateName, templates, editSubdomain, selectedTemplate]);

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
        // Guard: If we are in edit mode and fieldValues already has entries, 
        // it means we just loaded the project data. DON'T overwrite with defaults.
        const isEditModeJustLoaded = editSubdomain && Object.keys(fieldValues).length > 0;

        if (!selectedTemplate.static && selectedTemplate.fields) {
            if (!isEditModeJustLoaded) {
                const initialVals = {};
                selectedTemplate.fields.forEach(f => {
                    const key = typeof f === 'string' ? f : (f.id || f.key);
                    const defaultValue = typeof f === 'string'
                        ? (DEFAULT_VALUES[f] || '')
                        : (f.default !== undefined ? f.default : (DEFAULT_VALUES[key] || ''));
                    initialVals[key] = defaultValue;
                });
                setFieldValues(initialVals);
            }
        } else {
            if (!isEditModeJustLoaded) setFieldValues({});
        }

        const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
        const versionParam = selectedTemplate.version ? `?v=${selectedTemplate.version}` : '';
        fetch(`${apiBase}/api/template/raw/${selectedTemplate.name}${versionParam}`)
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


    async function handleSubmit(e) {
        e.preventDefault();
        setResult(null);

        if (!selectedTemplate) return toast.error('请选择一个网页模板');
        if (!subdomain) return toast.error('请给网页起一个专属网址');

        // Tier-based Length Guard: dynamic limit from backend status
        const minLen = status?.minDomainLen ?? 3;
        if (!editSubdomain && subdomain.length < minLen) {
            return toast.error(`该域名前缀太短啦，您的等级至少需要 ${minLen} 个字符哦`);
        }

        if (!user) {
            toast.error('请先登录后再发布网页 🔑');
            // Check if there's a referral to suggest registration
            const hasRef = searchParams.get('ref') || localStorage.getItem('rs_ref');
            navigate(hasRef ? '/auth?mode=register' : '/auth');
            return;
        }

        setLoading(true);
        const toastId = toast.loading(editSubdomain ? '正在更新您的浪漫网页...' : '正在为您全网生成中...');
        try {
            const response = await renderProject({
                subdomain,
                type: selectedTemplate.name,
                data: fieldValues,
                showViralFooter,
            });

            if (response.code !== 0) {
                toast.error(response.message || '生成失败', { id: toastId });
                return;
            }

            const pageUrl = response.data?.url || `https://${subdomain}.${BASE_DOMAIN}/`;
            setResult({ url: pageUrl });

            toast.success(
                <div style={{ fontSize: '0.85rem' }}>
                    🎉 {editSubdomain ? '更新成功！' : '发布成功！'}<br />
                    <a href={pageUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#d6336c', fontWeight: 'bold', display: 'block', margin: '4px 0' }}>
                        立即访问页面 →
                    </a>
                    <div style={{ opacity: 0.8, fontSize: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '4px' }}>
                        💡 提示：云端同步通常需要 30 秒，如点击后未见更新请刷新页面。
                    </div>
                </div>,
                { id: toastId, duration: 8000 }
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
        const baseTag = `<base href="https://www.${BASE_DOMAIN}/assets/${selectedTemplate.name}/" />`;

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
            {status?.isOverQuota && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '16px', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    <div style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: '1.5' }}>
                        <strong style={{ fontSize: '1rem' }}>进入维护模式</strong><br/>
                        由于您的配额已到期，您可以继续维护<strong>最近编辑过的一个网页</strong>，但目前只能使用<strong>“免费”模板</strong>进行更新。其他网页已暂时锁定，续费后将立即解锁。建议尽快续费以防止域名被回收。
                    </div>
                </div>
            )}

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
                                            <option key={t.name} value={t.name}>
                                                {t.tier === 'pro' ? '[PRO] ' : ''}{t.title || t.name}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedTemplate?.price > 0 && (
                                        <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--primary-light)', borderRadius: '8px', border: '1px dashed var(--primary-dark)', fontSize: '0.75rem', color: 'var(--primary-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>💎 <strong>单独买断价格:</strong> ¥{selectedTemplate.price}</span>
                                            <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>暂未开放支付</span>
                                        </div>
                                    )}
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
                                    {!editSubdomain && domainStatus !== 'idle' && (
                                        <div style={{
                                            fontSize: '0.8rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            marginTop: '6px',
                                            color: domainStatus === 'available' ? '#10b981' :
                                                   domainStatus === 'checking' ? '#64748b' : '#ef4444'
                                        }}>
                                            {domainStatus === 'checking' && <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>}
                                            {domainMsg}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                        💡 推荐：使用你们的名字缩写或纪念日
                                    </p>
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
                                        {/* System Features (Viral Footer) */}
                                        <hr className="builder-divider" />
                                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0.5rem 0' }}>
                                            <label htmlFor="viral-toggle" style={{ marginBottom: 0, cursor: 'pointer', flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--mid)' }}>📢 显示“制作同款”小挂件</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                                                    {status?.allowHideFooter === false
                                                        ? '⚠️ 您的等级需保留此功能以支持我们（默认开启）'
                                                        : '开启后页面底部将显示一个优雅的“制作同款”悬浮按钮'}
                                                </div>
                                            </label>
                                            <label className="switch">
                                                <input
                                                    id="viral-toggle"
                                                    type="checkbox"
                                                    checked={showViralFooter}
                                                    disabled={status?.allowHideFooter === false}
                                                    onChange={(e) => setShowViralFooter(e.target.checked)}
                                                />
                                                <span className="slider"></span>
                                            </label>
                                        </div>
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
