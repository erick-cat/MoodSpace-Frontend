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
            <h1 className="section-title">🎨 网页款式大厅</h1>
            <p className="section-sub">挑选一个你喜欢的风格，开始制作你的专属浪漫网页吧！</p>

            {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
            {error && <div className="alert alert--error">加载失败：{error}</div>}

            {!loading && !error && templates.length === 0 && (
                <div className="alert alert--info">
                    哎呀，目前还没有上架任何网页款式，请稍后再来看看。
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
                <p className="tmpl-card__title">📦 款式代码：{t.name}</p>
                <p className="tmpl-card__desc">
                    {t.static
                        ? '固定款式（纯视觉体验，内容无需修改）'
                        : `你可以修改的内容：${(t.fields ?? []).map(f => {
                            if (typeof f === 'string') return FIELD_LABELS[f] || f;
                            return f.label || f.id || f.key || '未知字段';
                        }).join('、') || '无'}`}
                </p>
                <div style={{ marginTop: '0.6rem' }}>
                    {/* 版本号已隐藏 */}
                </div>
            </div>
            <div className="tmpl-card__footer">
                <a
                    href={`/preview/${t.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                >
                    预览
                </a>
                <Link to={`/builder/${t.name}`} className="btn btn--primary btn--sm">
                    就选这个款式
                </Link>
            </div>
        </div>
    );
}
