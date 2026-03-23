import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
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
    const location = useLocation();
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
        const hideScrollbarStyle = `<style>::-webkit-scrollbar{display:none!important}*{scrollbar-width:none;-ms-overflow-style:none}</style>`;

        const headRegex = /<head[^>]*>/i;
        if (headRegex.test(rawHtml)) {
            previewHtml = rawHtml.replace(headRegex, (match) => `${match}\n  ${baseTag}\n  ${hideScrollbarStyle}`);
        } else {
            previewHtml = `${baseTag}\n${hideScrollbarStyle}\n${rawHtml}`;
        }

        previewHtml = previewHtml.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const k = key.trim();
            const val = fieldValues[k];
            // Only replace if user explicitly provided a non-empty value.
            // If the value is empty/unset, keep the original {{ placeholder }} so
            // the template's own isUninjected() / default-value JS can still run.
            if (val !== undefined && val !== '') return val;
            return match;
        });
    }

    // Fallback animation for Safari/older browsers without View Transitions
    const isFromHomeFallback = location.state?.from === 'home' && !('startViewTransition' in document);

    return (
        <div className={`w-full h-[100dvh] cosmic-bg overflow-hidden flex flex-col font-body text-on-surface ${isFromHomeFallback ? 'builder-slide-up-fallback' : 'animate-in fade-in duration-1000 ease-in-out'}`}>
            <main className="flex-grow w-full max-w-6xl mx-auto h-[calc(100dvh-5rem)] pb-12 pt-24 px-6 md:px-12 flex flex-col lg:flex-row gap-6 lg:gap-10 relative z-10 justify-center">

                {/* Left Panel: Workspace Area */}
                <section className="flex-1 flex flex-col w-full max-w-2xl mx-auto overflow-hidden h-full relative">
                    
                    {/* Header: Title and Gallery Link */}
                    <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0 pt-2 md:pt-4 w-full z-10 px-1">
                        <div className="text-on-surface-variant font-headline font-light text-base md:text-lg tracking-wide opacity-80 italic">
                            {editSubdomain ? '继续雕琢这份心意' : '那我们慢慢把它写下来'}
                        </div>
                        <Link
                            to="/gallery"
                            className="group flex items-center justify-center gap-1.5 text-secondary-dim hover:text-secondary transition-all font-headline font-light tracking-widest px-4 py-1.5 cursor-pointer rounded-full bg-secondary/5 hover:bg-secondary/10 border border-secondary/20 backdrop-blur-md text-xs shadow-sm whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined text-sm group-hover:rotate-12 transition-transform">explore</span>
                            模板大厅
                        </Link>
                    </div>

                    <form id="builder-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 w-full relative z-10 px-1">
                        
                        {/* Fixed Top Controls & Warnings */}
                        <div className="flex flex-col gap-4 md:gap-6 shrink-0 w-full mb-4 md:mb-6">
                            
                            {/* Status Warnings */}
                            {status?.isOverQuota && (
                                <div className="bg-error-container/20 border border-error-dim/40 p-4 rounded-xl flex gap-3 items-start animate-in fade-in">
                                    <span className="text-2xl">⚠️</span>
                                    <div className="text-sm text-error-dim leading-relaxed">
                                        <strong className="text-base text-error">进入维护模式</strong><br />
                                        由于您的配额已到期，您可以继续维护<strong>最近编辑过的一个网页</strong>，但目前只能使用<strong>“免费”模板</strong>进行更新。其他网页已暂时锁定，续费后将立即解锁。建议尽快续费以防止域名被回收。
                                    </div>
                                </div>
                            )}

                            {editSubdomain && status && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 items-start text-on-surface-variant">
                                    <span className="text-xl text-primary-dim">ℹ️</span>
                                    <div className="text-sm">
                                        当前为更新页面内容，不消耗建站网址数量配额。<br />
                                        <span className="opacity-80 mt-1 block">今日剩余可修改次数：<span className="text-primary font-bold">{status.maxDailyEdits - status.dailyUsedEdits} / {status.maxDailyEdits}</span></span>
                                    </div>
                                </div>
                            )}

                            {/* Template Selector */}
                            <div className="group">
                                <label className="text-xs uppercase tracking-[0.2em] text-primary-dim/60 font-bold mb-3 block">模板选择 | Template</label>
                                <select
                                    value={selectedTemplate?.name ?? ''}
                                    onChange={handleTemplateChange}
                                    required
                                    className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-lg md:text-xl font-light font-headline py-2 transition-all writing-area text-on-surface appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-surface text-on-surface">-- 请先选择一个模板 --</option>
                                    {templates.map((t) => (
                                        <option key={t.name} value={t.name} className="bg-surface text-on-surface">
                                            {t.tier === 'pro' ? '💎 [PRO] ' : ''}{t.title || t.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedTemplate?.price > 0 && (
                                    <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-xs text-primary-dim flex justify-between">
                                        <span>💎 <strong>单独买断价格:</strong> ¥{selectedTemplate.price}</span>
                                        <span className="opacity-60">暂未开放单独支付</span>
                                    </div>
                                )}
                            </div>

                            {/* Subdomain Input */}
                            <div className="group">
                                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-dim/60 font-bold mb-3">
                                    专属网址 | Domain
                                    {editSubdomain && <span className="text-on-surface-variant/50 font-normal lowercase tracking-normal">(不可修改)</span>}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={subdomain}
                                        onChange={(e) => !editSubdomain && setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="例如：our-love-story"
                                        required
                                        readOnly={!!editSubdomain}
                                        className={`flex-1 bg-transparent border-b ${editSubdomain ? 'border-outline-variant/10 text-on-surface-variant/50 cursor-not-allowed' : 'border-outline-variant/30 focus:border-primary'} focus:ring-0 text-xl md:text-2xl font-light font-headline py-2 transition-all writing-area text-on-surface`}
                                    />
                                    <span className="text-on-surface-variant text-base font-light">.{BASE_DOMAIN}</span>
                                </div>
                                {!editSubdomain && (
                                    <>
                                        <div className="text-xs text-error-dim mt-2 font-medium">⚠️ 专属网址一经创建永久绑定，无法修改或删除！</div>
                                        {domainStatus !== 'idle' && (
                                            <div className={`text-xs mt-2 flex items-center gap-2 ${domainStatus === 'available' ? 'text-green-400' : domainStatus === 'checking' ? 'text-on-surface-variant' : 'text-error-dim'}`}>
                                                {domainStatus === 'checking' && <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"></span>}
                                                {domainMsg}
                                            </div>
                                        )}
                                        <div className="text-xs text-on-surface-variant mt-1">💡 推荐：使用你们的名字缩写或纪念日 (如 xm-xh-520)</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Dynamic Fields Area container */}
                        {selectedTemplate && !selectedTemplate.static && (selectedTemplate.fields ?? []).length > 0 && (
                            <div className="flex-1 flex flex-col bg-surface/30 backdrop-blur-md border border-outline-variant/20 shadow-[inset_0_4px_24px_rgba(0,0,0,0.05)] rounded-2xl mb-[130px] w-full rounded-b-3xl overflow-hidden">
                                
                                {/* Fixed Header */}
                                <div className="p-5 md:p-8 pb-4 shrink-0 border-b border-outline-variant/10">
                                    <div className="text-primary-dim text-sm font-bold uppercase tracking-widest flex items-center gap-2 opacity-80">
                                        <span className="material-symbols-outlined text-base">edit_document</span>
                                        专属内容填写
                                    </div>
                                </div>

                                {/* Scrollable Fields */}
                                <div className="flex-1 overflow-y-auto scrollbar-hide p-5 md:p-8 pt-6 flex flex-col gap-6 md:gap-8">
                                    {selectedTemplate.fields.map((f) => {
                                        const key = typeof f === 'string' ? f : (f.id || f.key);
                                        const label = typeof f === 'string' ? (FIELD_LABELS[f] || f) : (f.label || f.id || f.key);
                                        const placeholder = typeof f === 'string'
                                            ? (`输入 ${FIELD_LABELS[f] || f}...`)
                                            : (f.placeholder || `输入 ${label}...`);
                                        const inputType = typeof f === 'string' ? 'textarea' : (f.type || 'text');

                                        return (
                                            <div className="group shrink-0 relative" key={key}>
                                                <label className="text-xs uppercase tracking-[0.2em] text-primary-dim/60 font-bold mb-3 block">{label}</label>
                                                {inputType === 'textarea' ? (
                                                    <textarea
                                                        rows={key === 'paragraphs' ? 6 : 3}
                                                        value={fieldValues[key] ?? ''}
                                                        onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                                                        placeholder={placeholder}
                                                        className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-lg md:text-xl font-light font-headline leading-relaxed resize-none writing-area text-on-surface transition-all"
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={fieldValues[key] ?? ''}
                                                        onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                                                        placeholder={placeholder}
                                                        className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-xl font-light font-headline py-2 transition-all writing-area text-on-surface"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Viral Footer Toggle */}
                                    <div className="group pt-6 border-t border-outline-variant/10 shrink-0">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <label className="text-sm font-bold text-on-surface md:text-base block mb-1">📢 显示“制作同款”按钮</label>
                                                <div className="text-xs text-on-surface-variant font-light leading-relaxed">
                                                    {status?.allowHideFooter === false
                                                        ? '⚠️ 您的等级需保留此功能以支持我们（默认开启）'
                                                        : '开启后页面底部将悬浮一个优雅的跳转按钮'}
                                                </div>
                                            </div>
                                            <label className="switch mt-1 shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={showViralFooter}
                                                    disabled={status?.allowHideFooter === false}
                                                    onChange={(e) => setShowViralFooter(e.target.checked)}
                                                />
                                                <span className="slider"></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </section>

                {/* Right Panel: Live Preview iframe (BSR) */}
                <section className="w-full lg:w-[380px] flex flex-col h-[600px] lg:h-[720px] max-h-[85vh] shrink-0 mx-auto lg:my-auto">
                    <div className="flex-1 glass-panel rounded-xl overflow-hidden border border-outline-variant/20 relative shadow-2xl flex flex-col group transition-all duration-500 hover:border-primary/30">
                        {/* Preview Header Overlay */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-surface/90 to-transparent z-10 p-6 pointer-events-none transition-opacity duration-300 group-hover:opacity-40">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-primary-dim font-bold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                Live Space Preview
                            </div>
                        </div>

                        {/* Iframe injection */}
                        <div className="flex-1 relative bg-black">
                            {(!selectedTemplate || !rawHtml) ? (
                                <div className="absolute inset-0 bg-surface/5 flex flex-col items-center justify-center pointer-events-none group-hover:bg-transparent transition-colors duration-500">
                                    <span className="material-symbols-outlined text-3xl md:text-5xl text-primary/30 mb-2 md:mb-4 group-hover:scale-110 transition-transform">visibility</span>
                                    <span className="text-on-surface-variant font-light text-sm tracking-widest opacity-80 group-hover:opacity-0 transition-opacity">填写左侧信息实时预览</span>
                                </div>
                            ) : (
                                <iframe
                                    srcDoc={previewHtml}
                                    style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                                    title="Live Preview"
                                    id="preview-iframe"
                                    className="absolute inset-0 z-0 bg-transparent"
                                />
                            )}
                        </div>
                    </div>
                </section>

            </main>

            {/* Fixed Floating Action Bar (Universal Navigation) */}
            <div className={`fixed bottom-[96px] md:bottom-[100px] left-0 w-full z-40 pointer-events-none`}>
                <div className="w-full max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center pointer-events-auto">
                    <button
                        onClick={() => {
                            const from = location.state?.from;
                            if (from === 'gallery') navigate('/gallery');
                            else if (from === 'myspace') navigate('/myspace');
                            else navigate('/', { state: { returnToStep: 2 } });
                        }}
                        className={`group flex items-center justify-center gap-2 text-on-surface hover:text-white transition-all font-headline font-light tracking-widest px-6 py-3 md:px-8 md:py-3.5 cursor-pointer rounded-full bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 backdrop-blur-xl shadow-lg shadow-black/20 text-sm md:text-base`}
                    >
                        <span className="material-symbols-outlined text-base md:text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        上一步
                    </button>

                    <button
                        type="submit"
                        form="builder-form"
                        disabled={loading || domainStatus === 'checking'}
                        className="group flex items-center justify-center gap-2 text-primary hover:text-primary-container transition-all font-headline font-medium tracking-widest px-8 py-3 md:px-10 md:py-3.5 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-xl shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed text-sm md:text-base w-max ease-out duration-500 hover:scale-[1.02] active:scale-95"
                    >
                        <span>{loading ? (editSubdomain ? '全网刷新' : '宇宙级生成') : (editSubdomain ? '更新当前宇宙' : '点亮这片星空')}</span>
                        {!loading && <span className="material-symbols-outlined text-base md:text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>}
                    </button>
                </div>
            </div>

            {/* Decorative Nebula Accents */}
            <div className="fixed top-1/4 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none z-[-1]"></div>
            <div className="fixed bottom-1/4 -left-24 w-80 h-80 bg-secondary/10 rounded-full blur-[100px] pointer-events-none z-[-1]"></div>
        </div>
    );
}
