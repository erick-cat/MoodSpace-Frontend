import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listTemplates, getTiers } from '../api/client.js';
import { INTENT_DATA } from '../data/intents.js';
import PosterModal from '../components/PosterModal.jsx';

const FILTER_SCENES = [
    { id: 'send_to_them', text: '发送给TA' },
    { id: 'self_record', text: '记录自我' },
    { id: 'celebrate', text: '庆祝 / 纪念' },
    { id: 'repair', text: '沟通 / 修复' },
    { id: 'share', text: '分享 / 展示' },
    { id: 'self_heal', text: '自我疗愈' },
    { id: 'duo_space', text: '双人空间' },
];

export default function Gallery() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Read intent/category from Router state or default to 'all'
    const initialCategory = location.state?.intent || 'all';
    const initialOption = location.state?.scene || location.state?.sceneText || 'all';
    
    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [activeOption, setActiveOption] = useState(initialOption);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    
    const [templates, setTemplates] = useState([]);
    const [tierConfigs, setTierConfigs] = useState({
        free: { label: "🌟 体验", bg: "#f0e6ee", color: "var(--pink)" },
        pro: { label: "💎 高级", bg: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "#fff" },
        "pro+": { label: "✨ 旗舰", bg: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" },
        partner: { label: "👑 合伙人", bg: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff" },
        admin: { label: "🛡️ 管理员", bg: "#1e293b", color: "#fbbf24" }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [posterTemplate, setPosterTemplate] = useState(null);

    // Fetch templates and tier configurations
    useEffect(() => {
        Promise.all([listTemplates(), getTiers()])
            .then(([d, tierRes]) => {
                // L6.7 Fix: Correctly extract the 'tiers' object from the backend response structure { success: true, tiers: { ... } }
                if (tierRes && tierRes.success && tierRes.tiers) {
                    setTierConfigs(prev => ({ ...prev, ...tierRes.tiers }));
                }

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

    // Filter templates based on active category and option
    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            const cats = t.categories || [];
            const matchCategory = activeCategory === 'all' || cats.includes(activeCategory);
            const matchOption = activeOption === 'all' || activeOption === '探索全部' || t.scene === activeOption || (t.tags && t.tags.includes(activeOption));
            return matchCategory && matchOption;
        });
    }, [templates, activeCategory, activeOption]);

    return (
        <div className="w-full min-h-screen pt-12 md:pt-20 pb-20 md:pb-24 px-3 md:px-12 max-w-[1600px] mx-auto flex flex-col font-body text-on-surface relative">
            {/* Background Base */}
            <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ background: 'radial-gradient(circle at 80% 20%, #1e1a41 0%, #0d0a27 100%)' }}></div>
            
            {/* Ambient Background Lights */}
            <div className="fixed top-1/4 -right-24 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
            <div className="fixed bottom-1/4 -left-24 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-[80px] pointer-events-none z-0"></div>

            {/* Floating Filter Header (Sticky) */}
            <div className="sticky top-16 md:top-20 z-30 -mx-3 md:-mx-12 px-3 md:px-12 py-2 md:py-5 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10 mb-4 md:mb-8 shadow-sm">
                <div className="max-w-[1600px] mx-auto">
                    
                    {/* --- MOBILE FILTER TRIGGER (< md) --- */}
                    <div className="flex items-center justify-between md:hidden">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">当前筛选</span>
                            <span className="text-sm font-medium text-primary flex items-center gap-1">
                                {activeCategory === 'all' ? '全部模板' : INTENT_DATA[activeCategory].categoryLabel}
                                {activeCategory !== 'all' && activeOption !== 'all' && (
                                    <>
                                        <span className="text-on-surface-variant/50">/</span>
                                        <span className="text-secondary-dim">
                                            {INTENT_DATA[activeCategory]?.options?.find(o => o.id === activeOption)?.text || FILTER_SCENES.find(o => o.id === activeOption)?.text || activeOption}
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsMobileFilterOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">tune</span>
                            <span className="text-sm font-medium">筛选</span>
                        </button>
                    </div>

                    {/* --- DESKTOP FILTER (>= md) --- */}
                    <div className="hidden md:block space-y-4 md:space-y-5">
                        {/* Level 1: Categories (Emotions) */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 pb-1">
                            <button 
                                onClick={() => setActiveCategory('all')}
                                className={`flex items-center gap-2 px-5 py-2 xl:px-6 xl:py-2.5 rounded-full transition-all duration-300 font-medium border shadow-sm flex-shrink-0 ${activeCategory === 'all' ? 'bg-primary/20 text-primary-fixed border-primary/40 shadow-primary/10' : 'text-on-surface-variant hover:bg-surface-container-high border-outline-variant/10 bg-surface-container-lowest'}`}
                            >
                                <span className="material-symbols-outlined text-lg">grid_view</span>
                                <span className="text-sm">全部模板</span>
                            </button>
                            {Object.entries(INTENT_DATA).map(([key, data]) => (
                                <button 
                                    key={key}
                                    onClick={() => setActiveCategory(key)}
                                    className={`flex items-center gap-2 px-5 py-2 xl:px-6 xl:py-2.5 rounded-full transition-all duration-300 font-medium border shadow-sm flex-shrink-0 ${activeCategory === key ? 'bg-primary/20 text-primary-fixed border-primary/40 shadow-primary/10' : 'text-on-surface-variant hover:bg-surface-container-high border-outline-variant/10 bg-surface-container-lowest'}`}
                                >
                                    <span className="material-symbols-outlined text-lg">{data.icon}</span>
                                    <span className="text-sm">{data.categoryLabel}</span>
                                </button>
                            ))}
                        </div>

                        {/* Level 2: Scenarios (Intents) - Always Show */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 animate-in fade-in duration-300 pb-1">
                            <div className="flex items-center shrink-0 mb-0 text-[10px] uppercase tracking-widest text-on-surface-variant/50 font-bold ml-2 mr-2">
                                <span className="material-symbols-outlined text-sm mr-1">subtitles</span>
                                具体场景
                            </div>
                            <button 
                                onClick={() => setActiveOption('all')}
                                className={`px-5 py-2 rounded-full text-xs font-medium transition-all border flex-shrink-0 ${activeOption === 'all' ? 'bg-secondary/20 text-secondary-dim border-secondary/40 shadow-sm' : 'bg-surface-container-low text-on-surface-variant/60 border-outline-variant/10 hover:bg-surface-container-high'}`}
                            >
                                全部场景
                            </button>
                            {FILTER_SCENES.map((opt) => (
                                <button 
                                    key={opt.id}
                                    onClick={() => setActiveOption(opt.id)}
                                    className={`px-5 py-2 rounded-full text-xs font-medium transition-all border flex-shrink-0 ${activeOption === opt.id ? 'bg-secondary/20 text-secondary-dim border-secondary/40 shadow-sm' : 'bg-surface-container-low text-on-surface-variant/60 border-outline-variant/10 hover:bg-surface-container-high'}`}
                                >
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 min-w-0 flex flex-col relative z-10">
                {/* Context Header (Simplified) */}
                <header className="mb-2 md:mb-4 relative z-10 w-full">
                    <h1 className="text-xl md:text-5xl font-headline font-light text-on-surface tracking-tight leading-tight">
                        {activeCategory === 'all' ? '发现更多表达心意的方式' : INTENT_DATA[activeCategory].title}
                    </h1>
                </header>

                <div className="flex items-center justify-between mb-4 md:mb-8 pb-3 md:pb-4 border-b border-outline-variant/10">
                    <div className="flex flex-col gap-0.5 md:gap-1">
                        <h3 className="text-base md:text-2xl font-headline font-medium text-on-surface">
                            {activeCategory === 'all' ? '为你推荐' : INTENT_DATA[activeCategory].categoryLabel}
                        </h3>
                        {activeCategory !== 'all' && activeOption !== 'all' && (
                            <p className="text-[10px] md:text-sm text-secondary-dim font-light tracking-wide italic">
                                “{INTENT_DATA[activeCategory]?.options?.find(o => o.id === activeOption)?.text || FILTER_SCENES.find(o => o.id === activeOption)?.text || activeOption}”
                            </p>
                        )}
                        {activeCategory === 'all' && activeOption !== 'all' && (
                            <p className="text-[10px] md:text-sm text-secondary-dim font-light tracking-wide italic">
                                “{FILTER_SCENES.find(o => o.id === activeOption)?.text || activeOption}”
                            </p>
                        )}
                    </div>
                    <span className="text-[10px] md:text-sm font-medium text-on-surface-variant bg-surface-container-high px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-outline-variant/10">
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

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-6 lg:gap-8 content-start mb-12">
                        {filteredTemplates.map((template, idx) => {
                            const isRecommended = idx < 2 && activeCategory !== 'all' && activeOption === 'all';
                            const isPro = template.tier === 'pro';
                            
                            // Map template category to a theme color
                            const getThemeColor = (name) => {
                                const lower = name.toLowerCase();
                                if (lower.includes('love') || lower.includes('confession') || lower.includes('anniversary')) return 'var(--theme-love)';
                                if (lower.includes('joy') || lower.includes('game') || lower.includes('moment')) return 'var(--theme-joy)';
                                if (lower.includes('guilt') || lower.includes('repair')) return 'var(--theme-guilt)';
                                if (lower.includes('sadness') || lower.includes('tree_hole')) return 'var(--theme-sadness)';
                                if (lower.includes('stress') || lower.includes('care')) return 'var(--theme-stress)';
                                if (lower.includes('calm') || lower.includes('city')) return 'var(--theme-calm)';
                                return 'var(--theme-neutral)';
                            };

                            const themeColor = getThemeColor(template.name);
                            
                            const tierKey = template.tier?.toLowerCase() || 'free';
                            const tier = tierConfigs[tierKey] || tierConfigs.free;

                            return (
                                <div 
                                    key={template.name}
                                    className="glass-card--premium shimmer-sweep group p-3.5 md:p-5 xl:p-8 rounded-xl md:rounded-2xl flex flex-col h-full relative overflow-hidden active:scale-[0.98] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] hover:-translate-y-2"
                                    style={{ '--accent-glow': `${themeColor}20` }}
                                >
                                    {/* Ambient Visual Header with Preview Overlay */}
                                    <div 
                                        className="ambient-header h-20 md:h-28 -mx-3.5 -mt-3.5 md:-mx-5 md:-mt-5 xl:-mx-8 xl:-mt-8 mb-3 md:mb-5 relative group/header cursor-pointer"
                                        style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, #0d0a27 100%)` }}
                                        onClick={() => window.open(`/preview/${template.name}`, '_blank')}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface/40"></div>
                                        
                                        {/* Procedural Mesh with Theme Color */}
                                        <div 
                                            className="absolute inset-0 opacity-30" 
                                            style={{ 
                                                background: `radial-gradient(circle at 30% 30%, ${themeColor} 0%, transparent 60%)`,
                                                filter: 'blur(30px)'
                                            }}
                                        ></div>

                                        {/* Status Badge (KV-defined styling) */}
                                        <div 
                                            className="premium-badge transition-transform group-hover:scale-110"
                                            style={{ background: tier.bg, color: tier.color, border: 'none' }}
                                        >
                                            <span className="text-[10px] md:text-[11px] font-bold tracking-tight whitespace-nowrap">
                                                {tier.label}
                                            </span>
                                        </div>

                                        {isRecommended && (
                                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/10 backdrop-blur-md text-white text-[9px] font-bold tracking-widest uppercase rounded border border-white/10 z-10">
                                                推荐
                                            </div>
                                        )}

                                        {/* Quick Preview Overlay (Visible on mobile by default) */}
                                        <div className="preview-overlay-btn">
                                            <span className="material-symbols-outlined">visibility</span>
                                            快速预览
                                        </div>

                                        {/* Theme Symbol */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                                            <span className="material-symbols-outlined text-5xl md:text-6xl text-white">
                                                {(template.name.includes('love') || template.name.includes('heart')) ? 'favorite' : 
                                                 template.name.includes('star') ? 'star' : 
                                                 template.name.includes('city') ? 'map' : 'auto_awesome'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Header Info - Now perfectly clean */}
                                    <div className="mb-1.5 md:mb-3 z-10 relative">
                                        <h4 className="text-sm md:text-lg lg:text-xl font-headline text-on-surface font-semibold truncate leading-tight group-hover:text-primary transition-colors" style={{ color: themeColor }}>
                                            {template.title || template.name}
                                        </h4>
                                    </div>

                                    <p className="text-on-surface-variant text-[10px] md:text-sm mb-4 md:mb-6 line-clamp-2 leading-relaxed flex-1 z-10 relative opacity-60 group-hover:opacity-100 transition-opacity">
                                        {template.desc || '精美的响应式网页模板，为您的心意增添专属色彩。'}
                                    </p>
                                    
                                    {/* Footer Actions */}
                                    <div className="mt-auto pt-3 md:pt-4 border-t border-white/5 z-10 relative flex items-center justify-between gap-3">
                                        <button 
                                            onClick={() => navigate(`/builder/${template.name}`, { state: { ...location.state, from: 'gallery' } })}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 md:py-2 rounded-lg bg-surface-container-highest hover:brightness-125 transition-all text-xs md:text-sm font-bold active:scale-95 border border-white/5 shadow-lg"
                                            style={{ backgroundColor: `${themeColor}20`, borderLeft: `2px solid ${themeColor}` }}
                                        >
                                            <span className="material-symbols-outlined text-[14px] md:text-[16px]">bolt</span>
                                            制作同款
                                        </button>
                                        
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => {
                                                    const url = `https://www.moodspace.xyz/preview/${template.name}`;
                                                    const title = template.title || template.name;
                                                    setPosterTemplate({ url, title, name: template.name, rawHtml: '' });
                                                    fetch(`https://www.moodspace.xyz/assets/${template.name}/index.html`)
                                                        .then(res => res.text())
                                                        .then(html => setPosterTemplate(prev => prev && prev.url === url ? { ...prev, rawHtml: html } : prev))
                                                        .catch(err => console.error('Failed to fetch template HTML', err));
                                                }}
                                                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-on-surface-variant transition-colors"
                                                title="分享海报"
                                            >
                                                <span className="material-symbols-outlined text-[16px] md:text-[18px]">image</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Theme Ambient Glow */}
                                    <div 
                                        className="absolute -bottom-16 -right-16 w-32 h-32 rounded-full blur-[40px] opacity-0 group-hover:opacity-20 transition-all duration-1000"
                                        style={{ backgroundColor: themeColor }}
                                    ></div>
                                </div>
                            );
                        })}


                    </div>
            </main>

            {/* --- MOBILE FILTER DRAWER (< md) --- */}
            <div className={`fixed inset-0 z-[110] md:hidden transition-opacity duration-300 ${isMobileFilterOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)}></div>
                
                {/* Bottom Sheet */}
                <div className={`absolute bottom-0 left-0 right-0 bg-surface-container border-t border-outline-variant/20 rounded-t-[2rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.2,1)] ${isMobileFilterOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-6"></div>
                    
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-headline font-medium text-on-surface">筛选模板</h3>
                        <button onClick={() => setIsMobileFilterOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant active:scale-95 transition-transform">
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[60vh] custom-scrollbar pb-8">
                        {/* Mobile Level 1 */}
                        <div className="mb-8">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-3 flex items-center">
                                <span className="material-symbols-outlined text-sm mr-1">mood</span>
                                情绪分类
                            </h4>
                            <div className="flex flex-wrap gap-2.5">
                                <button 
                                    onClick={() => setActiveCategory('all')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all font-medium border text-sm ${activeCategory === 'all' ? 'bg-primary/20 text-primary-fixed border-primary/40' : 'text-on-surface-variant hover:bg-surface-container-high border-outline-variant/10 bg-surface-container-low'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">grid_view</span>
                                    全部
                                </button>
                                {Object.entries(INTENT_DATA).map(([key, data]) => (
                                    <button 
                                        key={key}
                                        onClick={() => setActiveCategory(key)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all font-medium border text-sm ${activeCategory === key ? 'bg-primary/20 text-primary-fixed border-primary/40' : 'text-on-surface-variant hover:bg-surface-container-high border-outline-variant/10 bg-surface-container-low'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{data.icon}</span>
                                        {data.categoryLabel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Level 2 */}
                        <div className="animate-in fade-in duration-300">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 mb-3 flex items-center">
                                <span className="material-symbols-outlined text-sm mr-1">subtitles</span>
                                具体场景
                            </h4>
                            <div className="flex flex-wrap gap-2.5">
                                <button 
                                    onClick={() => { setActiveOption('all'); setIsMobileFilterOpen(false); }}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${activeOption === 'all' ? 'bg-secondary/20 text-secondary-dim border-secondary/40' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10'}`}
                                >
                                    全部场景
                                </button>
                                {FILTER_SCENES.map((opt) => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setActiveOption(opt.id); setIsMobileFilterOpen(false); }}
                                        className={`px-4 py-2 mb-1 rounded-xl text-sm font-medium transition-all border text-left ${activeOption === opt.id ? 'bg-secondary/20 text-secondary-dim border-secondary/40' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/10'}`}
                                    >
                                        {opt.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            

            <PosterModal
                isOpen={!!posterTemplate}
                onClose={() => setPosterTemplate(null)}
                projectUrl={posterTemplate?.url}
                title="模板预览"
                templateTitle={posterTemplate?.title}
                templateName={posterTemplate?.name}
                rawHtml={posterTemplate?.rawHtml}
            />
        </div>
    );
}
