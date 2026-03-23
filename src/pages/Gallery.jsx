import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTemplates } from '../api/client.js';

const FIELD_LABELS = {
    title: '网页标题',
    sender: '发送人 (你)',
    receiver: '接收人 (TA)',
    paragraphs: '浪漫留言'
};

export default function Gallery() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        listTemplates()
            .then((d) => setTemplates(d.templates ?? []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="page container">
            <h1 className="section-title">🎨 网页模板大厅</h1>
            <p className="section-sub">挑选一个你喜欢的风格，开始制作你的专属浪漫网页吧！</p>

            {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
            {error && <div className="alert alert--error">加载失败：{error}</div>}

            {!loading && !error && templates.length === 0 && (
                <div className="alert alert--info">
                    哎呀，目前还没有上架任何网页模板，请稍后再来看看。
                </div>
            )}

            <div className="grid">
                {templates.map((t) => <TemplateCard key={t.name} t={t} />)}
            </div>
        </div>
    );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function TemplateCard({ t }) {
    return (
        <div className="card tmpl-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '320px', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <h3 className="tmpl-card__title" style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.title || t.name}>
                        📦 {t.title || t.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {t.tier === 'pro' ? (
                            <span style={{ background: '#fff1f2', color: '#e11d48', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fb7185' }}>
                                PRO
                            </span>
                        ) : (
                            <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, border: '1px solid #10b981' }}>
                                免费
                            </span>
                        )}
                        {t.price > 0 && <span style={{ background: '#fffbeb', color: '#b45309', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fde68a' }}>¥{t.price}</span>}
                    </div>
                </div>

                <div style={{ color: '#64748b', fontSize: '0.9rem', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '5px' }}>
                    {t.static ? (
                        <p style={{ margin: 0 }}>固定模板（无需修改内容）</p>
                    ) : (
                        <>
                            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#475569' }}>包含以下配置项：</div>
                            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(t.fields ?? []).slice(0, 6).map((f, i) => {
                                    const label = typeof f === 'string' ? FIELD_LABELS[f] || f : f.label || f.id || f.key || '未知字段';
                                    return <li key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</li>;
                                })}
                                {(t.fields?.length || 0) > 6 && <li style={{ color: '#94a3b8', fontStyle: 'italic', listStyleType: 'none', paddingLeft: 0, marginLeft: '-20px' }}>... 以及 {(t.fields?.length || 0) - 6} 个其他项</li>}
                            </ul>
                        </>
                    )}
                </div>
            </div>
            
            <div className="tmpl-card__footer" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                <a
                    href={`/preview/${t.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ flex: 1, textAlign: 'center' }}
                >
                    预览
                </a>
                <Link to={`/builder/${t.name}`} state={{ from: 'gallery' }} className="btn btn--primary btn--sm" style={{ flex: 2, textAlign: 'center' }}>
                    使用模板
                </Link>
            </div>
        </div>
    );
}
