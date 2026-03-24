import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listTemplates } from '../api/client.js';
import { INTENT_DATA } from '../data/intents.js';

export default function Gallery() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Read intent from Router state or default to 'all'
    const initialIntent = location.state?.intent || 'all';
    const [activeIntent, setActiveIntent] = useState(initialIntent);
    
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch and enrich templates
    useEffect(() => {
        listTemplates()
            .then((d) => {
                const apiTemplates = d.templates ?? [];
                // Flatten intent metadata for fast lookup
                const metaMap = {};
                Object.values(INTENT_DATA).forEach(intent => {
                    intent.templates.forEach(t => metaMap[t.id] = t);
                });
                
                const enriched = apiTemplates.map(t => {
                    const meta = metaMap[t.name] || {};
                    return { 
                        ...t, 
                        desc: meta.desc, 
                        icon: meta.icon || 'web', 
                        color: meta.color || 'primary' 
                    };
                });
                setTemplates(enriched);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    // Filter templates based on active category
    const filteredTemplates = useMemo(() => {
        if (activeIntent === 'all') return templates;
        
        const intentConfig = INTENT_DATA[activeIntent];
        if (!intentConfig) return templates;

        const allowedIds = intentConfig.templates.map(t => t.id);
        return templates.filter(t => allowedIds.includes(t.name));
    }, [templates, activeIntent]);

    return (
        <div className="w-full min-h-screen pt-24 pb-24 px-6 md:px-12 max-w-[1600px] mx-auto flex flex-col font-body text-on-surface relative">
            {/* Background Base */}
            <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ background: 'radial-gradient(circle at 80% 20%, #1e1a41 0%, #0d0a27 100%)' }}></div>
            
            {/* Ambient Background Lights */}
            <div className="fixed top-1/4 -right-24 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
            <div className="fixed bottom-1/4 -left-24 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-[80px] pointer-events-none z-0"></div>

            {/* Context Header */}
            <header className="mb-10 lg:mb-16 relative z-10 w-full max-w-4xl">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary-dim text-xs font-bold tracking-widest uppercase border border-primary/20">
                        {activeIntent === 'all' ? 'Intent: 探索全部' : `Intent: ${INTENT_DATA[activeIntent].categoryLabel}`}
                    </span>
                    {location.state?.sceneText && activeIntent === location.state?.intent && (
                        <span className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary-dim text-xs font-bold tracking-widest uppercase border border-secondary/20 line-clamp-1 max-w-sm">
                            Scene: "{location.state.sceneText}"
                        </span>
                    )}
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-light text-on-surface tracking-tight leading-tight mb-4">
                    {activeIntent === 'all' ? '发现更多表达心意的方式' : INTENT_DATA[activeIntent].title}
                </h1>
                <p className="text-on-surface-variant text-base md:text-lg font-light leading-relaxed">
                    {activeIntent === 'all' ? '从海量优质模板中，挑选最契合你此刻情绪的那一个。用最浪漫的网页，承载你的专属记忆。' : INTENT_DATA[activeIntent].subtitle}
                </p>
            </header>

            {/* Main Layout Split */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative z-10 flex-1">
                
                {/* Left Categories Navbar (Sticky) */}
                <aside className="w-full lg:w-64 shrink-0">
                    <div className="sticky top-28 bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10 rounded-2xl p-4 md:p-6 shadow-lg">
                        <div className="mb-6 mb-4 px-2">
                            <h2 className="text-sm font-headline font-bold uppercase tracking-widest text-primary-dim opacity-80">Categories</h2>
                            <p className="text-on-surface-variant text-xs mt-1 font-light tracking-wide">按情绪场景筛选</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => setActiveIntent('all')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium tracking-wide ${activeIntent === 'all' ? 'text-primary-fixed bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                            >
                                <span className="material-symbols-outlined text-primary-dim text-xl">grid_view</span>
                                <span>全部模板</span>
                            </button>
                            {Object.entries(INTENT_DATA).map(([key, data]) => (
                                <button 
                                    key={key}
                                    onClick={() => setActiveIntent(key)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium tracking-wide ${activeIntent === key ? 'text-primary-fixed bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                                >
                                    <span className="material-symbols-outlined text-primary-dim text-xl">{data.icon}</span>
                                    <span>{data.categoryLabel}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Templates Grid Area */}
                <main className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/10">
                        <h3 className="text-xl md:text-2xl font-headline font-medium text-on-surface">为你推荐</h3>
                        <span className="text-sm font-medium text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full border border-outline-variant/10">
                            {filteredTemplates.length} 个模板
                        </span>
                    </div>
                    
                    {loading && (
                        <div className="flex justify-center items-center py-24">
                            <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-error-container/20 border border-error-dim/40 text-error-dim p-6 rounded-2xl">
                            <span className="material-symbols-outlined block text-4xl mb-2">error</span>
                            抱歉，加载模板时出现错误。请稍后刷新重试哦。<br/> ({error})
                        </div>
                    )}

                    {!loading && !error && filteredTemplates.length === 0 && (
                        <div className="glass-card rounded-2xl p-12 text-center border overflow-hidden relative border-outline-variant/10 bg-surface-container-low/40">
                             <span className="material-symbols-outlined text-6xl text-primary/20 mb-4 inline-block">inbox</span>
                             <h4 className="text-xl font-headline text-on-surface mb-2">哎呀，这里好像空空如也</h4>
                             <p className="text-on-surface-variant">
                                暂时没有找到这个分类下的网页模板。<br/>你可以前往“全部模板”看看其他的浪漫选择。
                             </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 lg:gap-8 content-start mb-12">
                        {filteredTemplates.map((template, idx) => {
                            const isRecommended = idx < 2 && activeIntent !== 'all';
                            const isPro = template.tier === 'pro';

                            return (
                                <div 
                                    key={template.name}
                                    className="glass-card group p-6 xl:p-8 rounded-2xl transition-all duration-500 hover:bg-surface-container-highest hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:border-primary/30 flex flex-col h-full relative overflow-hidden bg-surface-container-low border border-outline-variant/10"
                                >
                                    {isRecommended && (
                                        <div className="absolute top-0 right-0 px-4 py-1.5 bg-gradient-to-r from-primary to-primary-container text-on-primary text-[10px] font-bold tracking-widest uppercase rounded-bl-xl shadow-md z-10">
                                            核心推荐
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-4 z-10 relative">
                                        <h4 className="text-xl lg:text-2xl font-headline text-on-surface font-medium pr-4">{template.title || template.name}</h4>
                                        <span className={`material-symbols-outlined text-3xl opacity-80 ${isPro ? 'text-secondary-dim' : 'text-primary-dim'}`}>
                                            {template.icon}
                                        </span>
                                    </div>
                                    <p className="text-on-surface-variant text-sm lg:text-base mb-6 line-clamp-2 leading-relaxed flex-1 z-10 relative">
                                        {template.desc || '精美的响应式网页模板，为你的表达增添专属色彩。'}
                                    </p>
                                    
                                    {!template.static && (
                                        <div className="bg-surface-container-lowest/40 p-4 xl:p-5 rounded-xl mb-6 border border-outline-variant/5 shadow-inner z-10 relative group-hover:bg-surface-container-highest/60 transition-colors">
                                            <p className="text-xs lg:text-sm text-on-surface/70 italic font-light line-clamp-2">
                                                “包含 {(template.fields || []).length} 个专属配置项，一键生成浪漫宇宙...”
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-5 flex flex-wrap gap-4 items-center justify-between border-t border-outline-variant/10 z-10 relative">
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <button 
                                                onClick={() => navigate(`/builder/${template.name}`, { state: location.state })}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary-fixed transition-colors text-sm font-semibold group-hover:text-white"
                                            >
                                                制作同款
                                            </button>
                                            <a 
                                                href={`/preview/${template.name}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-variant text-on-surface-variant transition-colors text-sm font-medium"
                                                title="新标签页预览"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            </a>
                                        </div>
                                        <div className="flex gap-2">
                                            {isPro ? (
                                                <span className="bg-secondary/10 text-secondary-dim text-[10px] px-2 py-1 rounded-md font-bold tracking-wider uppercase border border-secondary/20">PRO</span>
                                            ) : (
                                                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-1 rounded-md font-bold tracking-wider uppercase border border-emerald-500/20">FREE</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Card Hover Glow */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
