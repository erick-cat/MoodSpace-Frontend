import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listTemplates, renderProject } from '../api/client.js';

const BASE_DOMAIN = '885201314.xyz';

export default function Builder() {
    const { templateName } = useParams();
    const navigate = useNavigate();

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
            .catch((e) => toast.error(`模板加载失败：${e.message}`))
            .finally(() => setInitialLoading(false));
    }, [templateName]);

    // Fetch raw HTML when template changes (for BSR Preview)
    useEffect(() => {
        if (!selectedTemplate) {
            setRawHtml(null);
            return;
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

        if (!selectedTemplate) return toast.error('请选择一个模板');
        if (!subdomain) return toast.error('请填写子域名');

        setLoading(true);
        const toastId = toast.loading('正在全网生成中...');
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
        const baseTag = `<base href="https://romancespace.885201314.xyz/assets/${selectedTemplate.name}/" />`;
        previewHtml = rawHtml.replace('<head>', `<head>\n  ${baseTag}`);
        previewHtml = previewHtml.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const k = key.trim();
            if (fieldValues[k] !== undefined && fieldValues[k] !== '') return fieldValues[k];
            return '';
        });
    }

    return (
        <div className="page container" style={{ maxWidth: 1000 }}>
            <h1 className="section-title">✏️ 创建专属页面</h1>
            <p className="section-sub">填写信息后，系统将即时生成带独立域名的浪漫网页。</p>

            {result && (
                <div className="alert alert--success" style={{ margin: '0 auto 1.5rem' }}>
                    🎉 页面发布成功！
                    <div className="alert__actions">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
                            访问页面 ↗
                        </a>
                        <a href={result.previewUrl} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">
                            预览版（绕过CDN缓存）
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
                            <div>正在拉取云端数据...</div>
                        </div>
                    )}

                    {!initialLoading && (
                        <>
                            {/* Template selector */}
                            <div className="form-group">
                                <label htmlFor="template">📦 选择模板</label>
                                <select
                                    id="template"
                                    value={selectedTemplate?.name ?? ''}
                                    onChange={handleTemplateChange}
                                    required
                                >
                                    <option value="">-- 请选择 --</option>
                                    {templates.map((t) => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Subdomain */}
                            <div className="form-group">
                                <label htmlFor="subdomain">🌐 专属子域名</label>
                                <div className="input-row">
                                    <input
                                        id="subdomain"
                                        type="text"
                                        value={subdomain}
                                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="e.g. sweeties"
                                        required
                                    />
                                    <span className="input-suffix">.{BASE_DOMAIN}</span>
                                </div>
                            </div>

                            {/* Dynamic fields from schema */}
                            {selectedTemplate && !selectedTemplate.static && (selectedTemplate.fields ?? []).length > 0 && (
                                <>
                                    <hr className="builder-divider" />
                                    <p className="builder-section-label">📝 个性化内容设置</p>
                                    {selectedTemplate.fields.map((key) => (
                                        <div className="form-group" key={key}>
                                            <label htmlFor={`f-${key}`}>{key}</label>
                                            <textarea
                                                id={`f-${key}`}
                                                rows={2}
                                                value={fieldValues[key] ?? ''}
                                                onChange={(e) => setFieldValues((p) => ({ ...p, [key]: e.target.value }))}
                                                placeholder={`请输入 ${key}`}
                                            />
                                        </div>
                                    ))}
                                </>
                            )}

                            <div className="builder-submit">
                                <button type="submit" className="btn btn--primary" disabled={loading}>
                                    {loading ? '全网生成中...' : '✨ 生成我的专属页面'}
                                </button>
                            </div>
                        </>
                    )}
                </form>

                {/* Right Panel: Live Preview iframe (BSR) */}
                {selectedTemplate && rawHtml && (
                    <div className="builder-card" style={{ flex: '1 1 400px', margin: 0, padding: 0, height: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>👀 实时预览 (0 延迟)</span>
                            <span style={{ fontSize: '12px', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>BSR 引擎</span>
                        </div>
                        <iframe
                            srcDoc={previewHtml}
                            style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                            title="Live Preview"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
