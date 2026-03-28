import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { INTENT_DATA } from '../data/intents.js';


export default function Home() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeScreen, setActiveScreen] = useState(location.state?.returnToStep || 0); // 0 = Hero, 1 = Scenes, 2 = Templates
    const [selectedType, setSelectedType] = useState('joy');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [customText, setCustomText] = useState('');

    const [isNavigating, setIsNavigating] = useState(false);

    // Sync activeScreen to GlobalFooter
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('moodspace-screen', { detail: activeScreen }));
    }, [activeScreen]);

    // Listen for logo click reset
    useEffect(() => {
        const handleResetHome = () => {
            setActiveScreen(0);
        };
        window.addEventListener('moodspace-reset-home', handleResetHome);
        return () => window.removeEventListener('moodspace-reset-home', handleResetHome);
    }, []);

    const handleIntentClick = (type) => {
        setSelectedType(type);
        setSelectedIndex(0);
        setCustomText('');
        setActiveScreen(1); // Go to Screen 1
    };

    const handleNextToTemplates = () => {
        const option = INTENT_DATA[selectedType].options[selectedIndex];
        
        // Handling redirects for 'explore' intent
        if (option?.id === 'explore') {
            navigate('/gallery', { state: { intent: selectedType } });
            return;
        }

        // Special handling for neutral category if needed
        if (selectedType === 'neutral' && option?.id === 'explore') {
            navigate('/gallery');
            return;
        }

        setActiveScreen(2);
    };

    const handleUseTemplate = (templateId) => {
        setIsNavigating(true);
        const finalScene = selectedIndex === -1 ? 'custom' : selectedIndex;
        const finalText = selectedIndex === -1 ? customText : INTENT_DATA[selectedType].options[selectedIndex].text;

        const doNavigate = () => {
            navigate(`/builder?type=${selectedType}&scene=${finalScene}&templateId=${templateId}`, { 
                state: { customText: finalText, from: 'home' }
            });
        };

        if (document.startViewTransition) {
            document.documentElement.classList.add('slide-up-nav');
            const transition = document.startViewTransition(() => {
                doNavigate();
            });
            transition.finished.finally(() => {
                document.documentElement.classList.remove('slide-up-nav');
            });
        } else {
            doNavigate();
        }
    };

    const currentIntent = INTENT_DATA[selectedType];
    const finalSelectedSceneText = selectedIndex === -1 
        ? (customText || "自定义想说的话")
        : currentIntent.options[selectedIndex].text;

    return (
        <div className="w-full h-[100dvh] overflow-hidden bg-surface cosmic-gradient">
            {/* Sliding Wrapper */}
            <div 
                className="w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col"
                style={{ transform: `translateY(-${activeScreen * 100}dvh)` }}
            >
                {/* ─── SCREEN 0: Hero Intent Selection ─── */}
                <div className="w-full h-[100dvh] shrink-0 flex flex-col items-center pt-[72px] md:pt-[80px] pb-[72px] md:pb-[24px] relative overflow-y-auto md:overflow-hidden custom-scrollbar">
                    <div className="absolute top-1/4 -left-20 w-[800px] h-[800px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(224,142,254,0.15) 0%, transparent 60%)' }}></div>
                    <div className="absolute bottom-1/4 -right-20 w-[700px] h-[700px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(144,148,250,0.15) 0%, transparent 60%)' }}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at center, rgba(36,32,74,0.4) 0%, transparent 60%)' }}></div>

                    <main className="relative z-10 w-full flex-1 flex flex-col items-center justify-center px-4 sm:px-6 md:px-8">
                        <div className="text-center max-w-4xl w-full mb-8 md:mb-10 lg:mb-12 leading-relaxed">
                            <h1 className="font-headline text-4xl md:text-6xl lg:text-[5rem] font-light tracking-tight text-on-surface mb-4 md:mb-6 leading-tight">
                                有些情绪，值得被<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">认真安放</span>
                            </h1>
                            <p className="font-body text-base md:text-xl text-on-surface-variant font-light tracking-wide max-w-2xl mx-auto opacity-90">
                                顺着心的指引，点击最契合你当下的选择
                            </p>
                        </div>

                        <div className="w-full max-w-[1100px] flex flex-wrap justify-center content-center gap-3 sm:gap-4 md:gap-5 mx-auto">
                            {Object.entries(INTENT_DATA).map(([key, data]) => (
                                <button 
                                    key={key} 
                                    onClick={() => handleIntentClick(key)} 
                                    className="glass-card w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.666rem)] lg:w-[calc(25%-0.9375rem)] max-w-[260px] p-5 md:p-6 lg:p-7 rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center justify-center text-center group cursor-pointer transition-transform duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:border-primary/50 hover:bg-surface-container-low/60 active:scale-95 bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/20 relative overflow-hidden shrink-0"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-[1rem] lg:rounded-[1.25rem] bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 lg:mb-5 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner relative z-10">
                                        <span className="material-symbols-outlined text-xl sm:text-2xl lg:text-3xl text-primary">{data.icon}</span>
                                    </div>
                                    <h3 className="font-headline text-base sm:text-lg lg:text-xl text-on-surface font-medium mb-1.5 lg:mb-2 tracking-wide group-hover:text-primary-dim transition-colors relative z-10">{data.categoryLabel}</h3>
                                    <p className="text-[10px] sm:text-xs lg:text-sm text-on-surface-variant font-light opacity-60 group-hover:opacity-100 transition-opacity leading-relaxed relative z-10">{data.title}</p>
                                </button>
                            ))}
                        </div>
                    </main>
                </div>

                {/* ─── SCREEN 1: Scene Selection Options ─── */}
                <div className="w-full h-[100dvh] shrink-0 pt-28 pb-32 flex flex-col relative z-20 overflow-y-auto custom-scrollbar">

                    <main className="flex-grow flex flex-col items-center justify-start px-5 md:px-12 max-w-5xl mx-auto w-full">
                        <header className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
                            <h2 className="font-headline text-2xl md:text-5xl lg:text-6xl font-light tracking-tight text-on-surface opacity-90 transition-all">
                                {currentIntent.title}
                            </h2>
                            <p className="text-base md:text-xl lg:text-2xl font-light text-on-surface-variant tracking-wide">
                                {currentIntent.subtitle}
                            </p>
                        </header>
                        
                        <div className="w-full max-w-2xl space-y-4 mb-32">
                            {currentIntent.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setSelectedIndex(idx); setCustomText(''); }}
                                    className={`w-full text-left group px-6 md:px-8 py-6 md:py-8 rounded-xl backdrop-blur-md border transition-all duration-300 ease-out flex flex-col items-start 
                                        ${selectedIndex === idx 
                                            ? 'bg-primary/10 border-primary/50 shadow-[0_0_30px_rgba(224,142,254,0.15)] ring-1 ring-primary/20 transform scale-[1.02]' 
                                            : 'bg-surface-container-low border-outline-variant/10 hover:bg-surface-container hover:border-primary/20 hover:shadow-[0_0_30px_rgba(224,142,254,0.1)]'
                                        }`}
                                >
                                    <span className={`text-lg md:text-xl lg:text-2xl font-light transition-colors duration-300 ${selectedIndex === idx ? 'text-primary' : 'text-on-surface group-hover:text-primary-dim'}`}>
                                        "{opt.text}"
                                    </span>
                                    <span className={`text-sm md:text-base font-light transition-all duration-300 overflow-hidden ${selectedIndex === idx ? 'text-primary-dim/90 mt-3 max-h-12 opacity-100' : 'text-on-surface-variant/50 max-h-0 opacity-0 group-hover:max-h-12 group-hover:opacity-100 group-hover:mt-3'}`}>
                                        {opt.helper}
                                    </span>
                                </button>
                            ))}
                            <div
                                onClick={() => setSelectedIndex(-1)}
                                className={`w-full text-left group px-6 md:px-8 py-6 md:py-8 rounded-xl backdrop-blur-md border transition-all duration-300 ease-out flex flex-col items-start cursor-pointer
                                    ${selectedIndex === -1 
                                        ? 'bg-primary/10 border-primary/50 shadow-[0_0_30px_rgba(224,142,254,0.15)] ring-1 ring-primary/20 transform scale-[1.02]' 
                                        : 'bg-surface-container-low border-outline-variant/10 hover:bg-surface-container hover:border-primary/20 hover:shadow-[0_0_30px_rgba(224,142,254,0.1)]'
                                    }`}
                            >
                                <span className={`text-sm md:text-base font-medium mb-3 transition-colors ${selectedIndex === -1 ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary-dim'}`}>
                                    或者，自己写下此刻想说的话：
                                </span>
                                <textarea 
                                    value={customText}
                                    onChange={(e) => {
                                        setCustomText(e.target.value);
                                        if (selectedIndex !== -1) setSelectedIndex(-1);
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedIndex(-1); }}
                                    placeholder="输入你的专属意境卡片文字..."
                                    className="w-full bg-surface-container-highest/50 border border-outline-variant/20 rounded-lg p-4 text-on-surface text-base md:text-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 resize-none h-24 font-light transition-all"
                                />
                            </div>
                        </div>
                    </main>
                </div>

                {/* ─── SCREEN 2: Template Recommendations ─── */}
                <div className="w-full h-[100dvh] shrink-0 pt-28 pb-48 flex flex-col relative z-20 overflow-y-auto custom-scrollbar">
                    {/* Immersive Background Glow for Screen 2 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none z-0 overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full blur-[120px] opacity-20" 
                             style={{ background: `radial-gradient(circle, ${selectedType === 'confession' ? 'rgba(224,142,254,1)' : selectedType === 'apology' ? 'rgba(144,148,250,1)' : 'rgba(255,215,0,0.8)'} 0%, transparent 70%)` }}>
                        </div>
                    </div>

                    <main className="flex-grow flex flex-col items-center justify-start px-5 max-w-7xl mx-auto w-full relative z-10 animate-in fade-in zoom-in-95 duration-1000">
                        
                        <section className="mb-12 md:mb-16 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-3">
                                        <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-surface-container-high text-primary border border-primary/20">
                                            意境：{currentIntent.categoryLabel}
                                        </span>
                                        <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-surface-container-high text-secondary border border-secondary/20 truncate max-w-[250px]">
                                            场景：{finalSelectedSceneText}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl md:text-5xl font-headline font-light tracking-tight text-on-surface">
                                        我们为你准备了几种更适合的表达方式
                                    </h1>
                                    <p className="text-on-surface-variant max-w-2xl text-base md:text-lg leading-relaxed">
                                        结合你的情感，这些专为 "{currentIntent.categoryLabel}" 打造的风格或许能帮你更好地表达。
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 w-full mb-16">
                            {currentIntent.templates.map((tpl, i) => (
                                <div key={tpl.id} className={`glass-card rounded-2xl p-6 md:p-8 flex flex-col h-full relative overflow-hidden group hover:bg-surface-variant/80 transition-all duration-500 ${i === 0 ? 'shadow-[0_0_30px_rgba(224,142,254,0.15)] ring-1 ring-primary/30' : ''}`}>
                                    {i === 0 && (
                                        <div className="absolute top-0 right-0 p-4">
                                            <span className="bg-primary/20 text-primary-fixed text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border border-primary/30 shadow-sm shadow-primary/40">极佳适配</span>
                                        </div>
                                    )}
                                    <div className="mb-6 md:mb-8">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 md:mb-8 bg-${tpl.color}/10 shadow-sm border border-${tpl.color}/20 group-hover:scale-110 transition-transform duration-500`}>
                                            <span className={`material-symbols-outlined text-2xl text-${tpl.color}`}>{tpl.icon}</span>
                                        </div>
                                        <h3 className="text-2xl md:text-3xl font-headline font-light mb-3 md:mb-4 tracking-tight">{tpl.name}</h3>
                                        <p className="text-on-surface-variant/80 text-sm md:text-base mb-6 md:mb-8 leading-relaxed font-light">{tpl.desc}</p>
                                    </div>
                                    
                                    <div className={`flex-grow bg-surface-container-lowest/30 rounded-lg p-5 mb-8 italic text-on-surface/80 text-xs md:text-sm leading-loose border-l-2 border-${tpl.color}/40 shadow-inner`}>
                                        <span className="text-on-surface-variant line-clamp-4">“...{finalSelectedSceneText.slice(0, 100)}...”</span>
                                    </div>

                                    <button 
                                        onClick={() => handleUseTemplate(tpl.id)}
                                        className={`w-full py-4 rounded-xl font-medium transition-all duration-300 active:scale-95 ${i === 0 
                                            ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary hover:scale-[1.02] shadow-[0_10px_20px_rgba(224,142,254,0.2)]' 
                                            : 'bg-surface-variant text-on-surface border border-outline-variant/30 hover:bg-surface-container-high hover:border-primary/30'
                                        }`}>
                                        使用此模板
                                    </button>
                                </div>
                            ))}
                        </section>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12 pb-6 w-full">
                            <Link 
                                to="/gallery" 
                                className="group flex items-center justify-center gap-2 text-secondary-dim hover:text-secondary transition-all font-headline font-light tracking-widest px-6 py-2 cursor-pointer rounded-full bg-secondary/5 hover:bg-secondary/10 border border-secondary/20 backdrop-blur-md text-sm shadow-sm"
                            >
                                <span className="material-symbols-outlined text-base group-hover:rotate-12 transition-transform">explore</span>
                                前往模板大厅寻找更多灵感
                            </Link>
                        </div>

                    </main>
                </div>

                {/* Removed Loading Screen to allow seamless transition directly to Builder */}
            </div>

            {/* Fixed Floating Action Bar (Screens 1 & 2) */}
            <div className={`fixed bottom-[130px] md:bottom-[100px] left-0 w-full z-40 pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] transform ${activeScreen > 0 && activeScreen < 3 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="w-full max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
                    <button 
                        onClick={() => setActiveScreen(Math.max(0, activeScreen - 1))}
                        disabled={activeScreen === 0}
                        className={`group hide-on-keyboard flex items-center justify-center gap-2 text-on-surface hover:text-white transition-all font-headline font-light tracking-widest px-6 py-3 md:px-8 md:py-3.5 cursor-pointer rounded-full bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 backdrop-blur-xl shadow-lg shadow-black/20 text-sm md:text-base disabled:opacity-0 disabled:cursor-not-allowed pointer-events-auto`}
                    >
                        <span className="material-symbols-outlined text-base md:text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        上一步
                    </button>
                    
                    <div className="flex justify-end relative w-48 transition-all duration-500">
                        {/* Next Button (Screen 1) */}
                        <button 
                            onClick={handleNextToTemplates}
                            disabled={selectedIndex === -1 && customText.trim() === ''}
                            className={`group flex items-center justify-center gap-2 text-primary hover:text-primary-container transition-all font-headline font-medium tracking-widest px-8 py-3 md:px-10 md:py-3.5 cursor-pointer rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-xl shadow-lg shadow-primary/20 text-sm md:text-base pointer-events-auto transition-all duration-500 ${activeScreen === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            下一步
                            <span className="material-symbols-outlined text-base md:text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
