import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

const INTENT_DATA = {
    confession: {
        title: "有些话，说出口不容易",
        subtitle: "你更接近哪一种情况？",
        options: [
            { text: "想对TA说点什么，但不知道怎么开口", helper: "那我们可以慢慢把它写下来" },
            { text: "有些暗恋，不想继续藏着了", helper: "勇敢一点，给故事一个开始" },
            { text: "只是想告诉TA，今天也很喜欢你", helper: "平淡日常里的直白心意" }
        ],
        templates: [
            { id: 'starry_confession', name: '星空告白', icon: 'auto_awesome', desc: '在漫天星辰的见证下，诉说最真挚的心意。', color: 'primary' },
            { id: 'love_letter', name: '情书时代', icon: 'favorite', desc: '干净纯粹的纸质书信风，字字句句皆是情深。', color: 'secondary' },
            { id: 'neon_heart', name: '霓虹心跳', icon: 'monitor_heart', desc: '轻快明亮的赛博氛围，直白表达心底的悸动。', color: 'tertiary' }
        ]
    },
    apology: {
        title: "想和好，却不知打破僵局",
        subtitle: "这封信，希望是和解的开始。",
        options: [
            { text: "对不起，那天是我态度不好", helper: "退一步，让关系重新呼吸" },
            { text: "其实我还在乎你，不想冷战了", helper: "坦诚脆弱也是一种勇敢" },
            { text: "惹你生气了，这该怎么办才好", helper: "低头不代表认输，代表珍惜" }
        ],
        templates: [
            { id: 'rainy_apology', name: '雨夜低语', icon: 'water_drop', desc: '滴答的雨声中，藏着最诚恳的歉意。', color: 'primary' },
            { id: 'warm_light', name: '微光倾听', icon: 'wb_incandescent', desc: '像一盏深夜的暖光灯，等待关系重新回暖。', color: 'secondary' },
            { id: 'broken_glass', name: '时光拼图', icon: 'extension', desc: '把破碎的情绪慢慢拾起，重新拼凑完整。', color: 'tertiary' }
        ]
    },
    anniversary: {
        title: "每一个日子，都值得铭记",
        subtitle: "回首一起走过的路...",
        options: [
            { text: "这是我们在一起的第N天", helper: "时间是最好的见证者" },
            { text: "祝你生日快乐，我的唯一", helper: "把最好的祝福打包送给你" },
            { text: "关于我们的专属纪念日", helper: "那些细微的日常，全都是浪漫" }
        ],
        templates: [
            { id: 'golden_memories', name: '流金岁月', icon: 'hourglass_empty', desc: '用闪耀温暖的倒计时，记录你们共同的时间。', color: 'primary' },
            { id: 'celebration_fireworks', name: '花火灿烂', icon: 'celebration', desc: '浪漫绚烂的烟火特效，点燃这个重要的日子。', color: 'secondary' },
            { id: 'polaroid_wall', name: '拍立得影集', icon: 'photo_library', desc: '一张张滑过的相片，串联起所有的甜蜜瞬间。', color: 'tertiary' }
        ]
    },
    memory: {
        title: "时光太浅，回忆太深",
        subtitle: "你想留下哪些珍贵的瞬间？",
        options: [
            { text: "只是一次平凡却难忘的约会", helper: "因为是你，所以特别" },
            { text: "一起去过的地方，看过的风景", helper: "照片会褪色，但记忆不会" },
            { text: "关于我们的“第一次”合集", helper: "第一次牵手，第一次旅行..." }
        ],
        templates: [
            { id: 'vintage_film', name: '复古胶卷', icon: 'movie', desc: '老电影般的放映效果，让记忆隽永留存。', color: 'primary' },
            { id: 'breeze_diary', name: '微风手账', icon: 'menu_book', desc: '清新自然的手账记录风格，留住那一天的阳光。', color: 'secondary' },
            { id: 'constellation_map', name: '星轨连线', icon: 'share', desc: '每一个回忆都是一颗星，连成专属你们的星座。', color: 'tertiary' }
        ]
    },
    diary: {
        title: "今天的心情，是什么颜色？",
        subtitle: "随便写写，反正只有空间懂你。",
        options: [
            { text: "今天有点累，但还是想记录下", helper: "给自己一个拥抱" },
            { text: "遇到了一件很开心的小事", helper: "让快乐的保质期更长一点" },
            { text: "此刻有点想念某个人", helper: "思念是一种无声的回音" }
        ],
        templates: [
            { id: 'minimal_white', name: '极简白纸', icon: 'check_box_outline_blank', desc: '没有任何打扰，只留下最纯粹的黑白文字。', color: 'primary' },
            { id: 'lofi_room', name: 'Lofi 房间', icon: 'headphones', desc: '伴随白噪音与暗光，享受独处的倾诉感。', color: 'secondary' },
            { id: 'sunset_glow', name: '落日余晖', icon: 'wb_twilight', desc: '像黄昏时的云彩一样，温柔包裹所有的思绪。', color: 'tertiary' }
        ]
    }
};

export default function Home() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeScreen, setActiveScreen] = useState(location.state?.returnToStep || 0); // 0 = Hero, 1 = Scenes, 2 = Templates
    const [selectedType, setSelectedType] = useState('confession');
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
        // Validation mapping occurs automatically. Go to Screen 2.
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
                <div className="w-full h-[100dvh] shrink-0 flex flex-col items-center justify-between relative pt-20">
                    <div className="absolute top-1/4 -left-20 w-[800px] h-[800px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(224,142,254,0.15) 0%, transparent 60%)' }}></div>
                    <div className="absolute bottom-1/4 -right-20 w-[700px] h-[700px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(144,148,250,0.15) 0%, transparent 60%)' }}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at center, rgba(36,32,74,0.4) 0%, transparent 60%)' }}></div>
                    
                    <main className="relative z-10 w-full flex-grow flex flex-col items-center justify-center">
                        <div className="text-center max-w-4xl px-6 mb-20 leading-relaxed mt-[-40px]">
                            <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl font-light tracking-tight text-on-surface mb-8 leading-tight">
                                有些情绪，值得被<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">认真安放</span>
                            </h1>
                            <p className="font-body text-lg md:text-2xl text-on-surface-variant font-light tracking-wide max-w-2xl mx-auto">
                                顺着心的指引，点击最契合你当下的选择
                            </p>
                        </div>
                        
                        <div className="w-full max-w-[1600px] px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-16 leading-relaxed">
                            <button onClick={() => handleIntentClick('confession')} className="glass-card p-6 md:p-8 rounded-xl flex flex-col items-center text-center group cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-primary/40">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 md:mb-6 group-hover:bg-primary/20 transition-colors">
                                    <span className="material-symbols-outlined text-2xl md:text-3xl text-primary" data-icon="mail">mail</span>
                                </div>
                                <h3 className="font-headline text-lg md:text-xl text-on-surface font-light mb-1 md:mb-2">浪漫表白</h3>
                                <p className="text-xs md:text-sm text-on-surface-variant font-light">表达掩躲在心底的想法</p>
                            </button>
                            <button onClick={() => handleIntentClick('apology')} className="glass-card p-6 md:p-8 rounded-xl flex flex-col items-center text-center group cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-secondary/40">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 md:mb-6 group-hover:bg-secondary/20 transition-colors">
                                    <span className="material-symbols-outlined text-2xl md:text-3xl text-secondary" data-icon="rebase_edit">rebase_edit</span>
                                </div>
                                <h3 className="font-headline text-lg md:text-xl text-on-surface font-light mb-1 md:mb-2">想和TA和好</h3>
                                <p className="text-xs md:text-sm text-on-surface-variant font-light">修补一段脆弱的关系</p>
                            </button>
                            <button onClick={() => handleIntentClick('anniversary')} className="glass-card p-6 md:p-8 rounded-xl flex flex-col items-center text-center group cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-tertiary/40">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 md:mb-6 group-hover:bg-tertiary/20 transition-colors">
                                    <span className="material-symbols-outlined text-2xl md:text-3xl text-tertiary" data-icon="auto_awesome">auto_awesome</span>
                                </div>
                                <h3 className="font-headline text-lg md:text-xl text-on-surface font-light mb-1 md:mb-2">纪念一个时刻</h3>
                                <p className="text-xs md:text-sm text-on-surface-variant font-light">留住那份珍贵的喜悦</p>
                            </button>
                            <button onClick={() => handleIntentClick('memory')} className="glass-card p-6 md:p-8 rounded-xl flex flex-col items-center text-center group cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-primary-container/40">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 md:mb-6 group-hover:bg-primary-container/20 transition-colors">
                                    <span className="material-symbols-outlined text-2xl md:text-3xl text-primary-container" data-icon="cloud">cloud</span>
                                </div>
                                <h3 className="font-headline text-lg md:text-xl text-on-surface font-light mb-1 md:mb-2">记录一段回忆</h3>
                                <p className="text-xs md:text-sm text-on-surface-variant font-light">珍藏那些心动的瞬间</p>
                            </button>
                            <button onClick={() => handleIntentClick('diary')} className="glass-card p-6 md:p-8 rounded-xl flex flex-col items-center text-center group cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:border-on-surface-variant/40 sm:col-span-2 md:col-span-1">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 md:mb-6 group-hover:bg-on-surface-variant/20 transition-colors">
                                    <span className="material-symbols-outlined text-2xl md:text-3xl text-on-surface-variant" data-icon="dark_mode">dark_mode</span>
                                </div>
                                <h3 className="font-headline text-lg md:text-xl text-on-surface font-light mb-1 md:mb-2">随便写写心情</h3>
                                <p className="text-xs md:text-sm text-on-surface-variant font-light">记录这一刻最真实的感触</p>
                            </button>
                        </div>
                    </main>
                    <div className="w-full h-24 shrink-0"></div> {/* Spacer to replace footer in flow */}
                </div>

                {/* ─── SCREEN 1: Scene Selection Options ─── */}
                <div className="w-full h-[100dvh] shrink-0 pt-24 pb-48 flex flex-col relative z-20 overflow-y-auto custom-scrollbar">

                    <main className="flex-grow flex flex-col items-center justify-start px-6 md:px-12 max-w-5xl mx-auto w-full">
                        <header className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
                            <h2 className="font-headline text-3xl md:text-5xl lg:text-6xl font-light tracking-tight text-on-surface opacity-90 transition-all">
                                {currentIntent.title}
                            </h2>
                            <p className="text-lg md:text-xl lg:text-2xl font-light text-on-surface-variant tracking-wide">
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
                <div className="w-full h-[100dvh] shrink-0 pt-24 pb-48 flex flex-col relative z-20 overflow-y-auto custom-scrollbar">

                    <main className="flex-grow flex flex-col items-center justify-start px-8 max-w-[1600px] mx-auto w-full">
                        
                        <section className="mb-12 md:mb-16 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-3">
                                        <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-surface-container-high text-primary border border-primary/20">
                                            意境：{selectedType === 'confession' ? '浪漫表白' : selectedType === 'apology' ? '想和TA和好' : selectedType === 'anniversary' ? '纪念一个时刻' : selectedType === 'memory' ? '记录一段回忆' : '随便写写心情'}
                                        </span>
                                        <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-surface-container-high text-secondary border border-secondary/20 truncate max-w-[250px]">
                                            场景：{finalSelectedSceneText}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl md:text-5xl font-headline font-light tracking-tight text-on-surface">
                                        我们为你准备了几种更适合的表达方式
                                    </h1>
                                    <p className="text-on-surface-variant max-w-2xl text-base md:text-lg leading-relaxed">
                                        结合你的情感，这些专为 "{selectedType === 'confession' ? '告白' : '此刻'}" 打造的风格或许能帮你更好地表达。
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
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 md:mb-6 bg-${tpl.color}/10 shadow-sm`}>
                                            <span className={`material-symbols-outlined text-${tpl.color}`}>{tpl.icon}</span>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-headline font-normal mb-2 md:mb-3">{tpl.name}</h3>
                                        <p className="text-on-surface-variant text-sm md:text-base mb-4 md:mb-6 leading-relaxed">{tpl.desc}</p>
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
            <div className={`fixed bottom-[96px] md:bottom-[100px] left-0 w-full z-40 pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] transform ${activeScreen > 0 && activeScreen < 3 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 flex justify-between items-center pointer-events-auto">
                    <button 
                        onClick={() => setActiveScreen(Math.max(0, activeScreen - 1))}
                        disabled={activeScreen === 0}
                        className={`group flex items-center justify-center gap-2 text-on-surface hover:text-white transition-all font-headline font-light tracking-widest px-6 py-3 md:px-8 md:py-3.5 cursor-pointer rounded-full bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 backdrop-blur-xl shadow-lg shadow-black/20 text-sm md:text-base disabled:opacity-0 disabled:cursor-not-allowed`}
                    >
                        <span className="material-symbols-outlined text-base md:text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        上一步
                    </button>
                    
                    <div className="flex justify-end relative w-48 transition-all duration-500">
                        {/* Next Button (Screen 1) */}
                        <button 
                            onClick={handleNextToTemplates}
                            disabled={selectedIndex === -1 && customText.trim() === ''}
                            className={`absolute right-0 top-1/2 -translate-y-1/2 group flex items-center justify-center gap-2 text-primary hover:text-primary-container transition-all font-headline font-medium tracking-widest px-8 py-3 md:px-10 md:py-3.5 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-xl shadow-lg shadow-primary/20 disabled:opacity-0 disabled:pointer-events-none text-sm md:text-base w-max ease-out duration-500 ${activeScreen === 1 ? 'scale-100 opacity-100 delay-100 pointer-events-auto z-10' : 'scale-75 opacity-0 pointer-events-none z-0'}`}
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
