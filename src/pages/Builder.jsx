import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listTemplates, renderProject } from '../api/client.js';
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

export default function Builder() {
    const { templateName } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelected] = useState(null);
    const [subdomain, setSubdomain] = useState('');
    const [fieldValues, setFieldValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [result, setResult] = useState(null); // { url, previewUrl }

    // BSR (Browser-Side Rendering) Raw HTML
    const [rawHtml, setRawHtml] = useState(null);

    // Load template list once
    useEffect(() => {
        setInitialLoading(true);
        listTemplates()
            .then((d) => {
                const list = d.templates ?? [];
                setTemplates(list);
                if (templateName) {
                    const found = list.find((t) => t.name === templateName);
                    if (found) setSelected(found);
                } else {
                    setSelected(null);
                }
            })
            .catch((e) => toast.error(`网页款式列表获取失败：${e.message}`))
            .finally(() => setInitialLoading(false));
    }, [templateName]);

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
        if (found) navigate(`/builder/${found.name}`, { replace: true });
        else navigate('/builder', { replace: true });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setResult(null);

        if (!selectedTemplate) return toast.error('请选择一个网页款式');
        if (!subdomain) return toast.error('请给网页起一个专属网址');

        // Guard: require login to publish
        if (!user) {
            toast.error('请先登录后再发布网页 🔑');
            navigate('/auth');
            return;
        }

        setLoading(true);
        const toastId = toast.loading('正在为您全网生成中...');
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
            const previewUrl = `${pageUrl}?preview=${Date.now()}`;
            setResult({ url: pageUrl, previewUrl });

            toast.success(
                <span>
                    🎉 发布成功！<br />
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#d6336c', fontWeight: 'bold' }}>
                        点击预览 →
                    </a>
                </span>,
                { id: toastId, duration: 6000 }
            );
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
        
        // Robust injection: find <head> case-insensitive, or prepend if missing
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
            <h1 className="section-title">✏️ 制作专属网页</h1>
            <p className="section-sub">填写下方信息后，系统将即时生成带有专属独立网址的浪漫网页。</p>

            {result && (
                <div className="alert alert--success" style={{ margin: '0 auto 1.5rem' }}>
                    🎉 页面发布成功！
                    <div className="alert__actions">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
                            访问页面 ↗
                        </a>
                        <a href={result.previewUrl} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">
                            预览版（如果遇到旧内容，请点此访问）
                        </a>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Left Panel: Form */}
                <form onSubmit={handleSubmit} className="builder-card" style={{ flex: '1 1 350px', margin: 0 }}>

                    {initialLoading && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                            <div className="spinner" style={{ marginBottom: '10px' }}></div>
                            <div>正在获取款式列表...</div>
                        </div>
                    )}

                    {!initialLoading && (
                        <>
                            {/* Template selector */}
                            <div className="form-group">
                                <label htmlFor="template">📦 选择网页款式</label>
                                <select
                                    id="template"
                                    value={selectedTemplate?.name ?? ''}
                                    onChange={handleTemplateChange}
                                    required
                                >
                                    <option value="">-- 请先选择款式 --</option>
                                    {templates.map((t) => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Subdomain */}
                            <div className="form-group">
                                <label htmlFor="subdomain">🌐 给网页定个专属网址</label>
                                <div className="input-row">
                                    <input
                                        id="subdomain"
                                        type="text"
                                        value={subdomain}
                                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="例如：our-love-story"
                                        required
                                    />
                                    <span className="input-suffix">.{BASE_DOMAIN}</span>
                                </div>
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
                                <button type="submit" className="btn btn--primary" disabled={loading}>
                                    {loading ? '全网生成中...' : '✨ 一键生成我的专属网页'}
                                </button>
                            </div>
                        </>
                    )}
                </form>

                {/* Right Panel: Live Preview iframe (BSR) - Mobile Form Factor */}
                {selectedTemplate && rawHtml && (
                    <div className="builder-preview-wrapper" style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', margin: 0 }}>
                        <div className="mobile-mockup" style={{ 
                            width: '320px', 
                            height: '600px', 
                            background: '#fff', 
                            borderRadius: '36px', 
                            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                            border: '12px solid #0f172a',
                            overflow: 'hidden',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ padding: '8px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{FIELD_LABELS.title ? '预览效果' : 'Preview'}</span>
                                <span style={{ fontSize: '10px', background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>BSR</span>
                            </div>
                            <iframe
                                srcDoc={previewHtml}
                                style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Live Preview"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
