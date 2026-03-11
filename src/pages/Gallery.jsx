import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTemplates } from '../api/client.js';

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
            <h1 className="section-title">🎨 模板库</h1>
            <p className="section-sub">挑选一个你喜欢的风格，开始制作你的专属浪漫网页。</p>

            {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
            {error && <div className="alert alert--error">加载失败：{error}</div>}

            {!loading && !error && templates.length === 0 && (
                <div className="alert alert--info">
                    暂无可用模板，请联系管理员上传模板后再来。
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
        <div className="card tmpl-card">
            <div>
                <p className="tmpl-card__title">📦 {t.name}</p>
                <p className="tmpl-card__desc">
                    {t.static
                        ? '静态模板（内容固定）'
                        : `可定制字段：${(t.fields ?? []).join('、') || '无'}`}
                </p>
                <div style={{ marginTop: '0.6rem' }}>
                    <span className="badge">{t.version}</span>
                </div>
            </div>
            <div className="tmpl-card__footer">
                <a
                    href={`${API_BASE}/api/template/preview/${t.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                >
                    预览
                </a>
                <Link to={`/builder/${t.name}`} className="btn btn--primary btn--sm">
                    使用此模板
                </Link>
            </div>
        </div>
    );
}
