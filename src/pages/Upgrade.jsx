import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Upgrade() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [payingId, setPayingId] = useState(null);
    
    // Polling State
    const orderNoParam = searchParams.get('order_no');
    const [pollStatus, setPollStatus] = useState('Verifying payment status...');
    const [isSuccess, setIsSuccess] = useState(false);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        if (orderNoParam) {
            // Polling Mode (Redirected from ZhifuFM)
            setLoading(false);
            const interval = setInterval(async () => {
                try {
                    const url = `${API_BASE}/api/payment/query?order_no=${orderNoParam}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    if (data.success) {
                        if (data.status === 'success') {
                            setPollStatus('支付成功！您的权益已为您极速发放完毕 🎉');
                            setIsSuccess(true);
                            clearInterval(interval);
                            toast.success('权益已到账！请刷新页面生效。');
                            setTimeout(() => navigate('/myspace'), 3000);
                        } else if (data.status === 'processing' || data.status === 'paid') {
                            setPollStatus('资金已到位，正为您注入超级魔力... ⚡');
                        } else if (data.status === 'pending') {
                            setPollStatus('正在等待支付网关确认，请稍候... 💸');
                        } else {
                            setPollStatus('支付好像出了点问题，如果已扣款请联系客服 😥');
                            clearInterval(interval);
                        }
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 2000);
            return () => clearInterval(interval);
        } else {
            // Normal Page Mode
            fetchPricing();
        }
    }, [orderNoParam]);

    const fetchPricing = async () => {
        try {
            const url = `${API_BASE}/api/payment/pricing?userId=${user?.id || ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setConfigs(data.data || []);
            }
        } catch (e) {
            toast.error('无法获取定价信息');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async (config, payType = 'wechat') => {
        if (!user) {
            toast.error('请先登录');
            return navigate('/auth');
        }
        setPayingId(config.id);
        try {
            const url = `${API_BASE}/api/payment/create`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    configId: config.id, // Primary Identifier
                    tier: config.tier,
                    duration_months: config.duration_months,
                    payType
                })
            });
            const data = await res.json();
            if (data.success && data.payUrl) {
                // Open payment in a new tab
                window.open(data.payUrl, '_blank');
                // Stay on this page for polling
                toast.success('由于合规要求，请在新打开的页面完成支付。');
            } else {
                toast.error(data.error || '创建订单失败');
            }
        } catch (e) {
            toast.error('网络请求失败');
        } finally {
            setPayingId(null);
        }
    };

    if (loading) return (
        <div className="w-full min-h-screen pt-[100px] flex justify-center items-center bg-surface cosmic-gradient">
            <div className="spinner w-10 h-10 border-4 border-outline-variant/30 border-t-primary rounded-full animate-spin"></div>
        </div>
    );

    // Render Polling View
    if (orderNoParam) {
        return (
            <div className="w-full min-h-screen pt-[120px] pb-20 bg-surface cosmic-gradient text-on-surface font-body px-5">
                <div className="max-w-xl mx-auto glass-card bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/20 p-10 rounded-[2rem] text-center shadow-2xl">
                    <div className="text-6xl mb-6">{isSuccess ? '✅' : '⏳'}</div>
                    <h2 className="font-headline text-2xl font-medium mb-4">订单状态追踪</h2>
                    <div className="text-on-surface-variant text-lg mb-8 leading-relaxed">
                        {pollStatus}
                    </div>
                    {!isSuccess && <div className="spinner w-8 h-8 border-4 border-outline-variant/30 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>}
                    {isSuccess && (
                        <button 
                            onClick={() => navigate('/myspace')} 
                            className="bg-primary text-on-primary px-8 py-3 rounded-xl font-medium transition-transform hover:-translate-y-1 shadow-[0_10px_20px_rgba(224,142,254,0.2)] mt-4"
                        >
                            返回个人中心
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Render Pricing View
    return (
        <div className="w-full min-h-[100dvh] pt-[100px] md:pt-[120px] pb-10 bg-surface cosmic-gradient text-on-surface font-body relative overflow-hidden">
            {/* Immersive Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[100px] bg-primary/10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] bg-secondary/10 pointer-events-none"></div>

            <div className="max-w-[1100px] mx-auto px-5 relative z-10">
                {/* --- Hero Section --- */}
                <div className="text-center mb-12 lg:mb-20">
                    <div className="inline-block px-6 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-6 backdrop-blur-md shadow-[0_4px_15px_rgba(224,142,254,0.1)]">
                        ✨ 开启您的专属浪漫空间
                    </div>
                    <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 leading-tight">
                        选择最适合您的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary font-medium">特权等级</span>
                    </h1>
                    <p className="text-on-surface-variant text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        加入 Pro 会员或合伙人计划，解锁无限创意模板与专属自定义功能，让每一个浪漫时刻都值得被永久铭记。
                    </p>
                </div>

                {/* --- Benefit Highlights --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 md:mb-24">
                    {[
                        { icon: '🎨', title: '无限模板', desc: '解锁全场 100+ 精致浪漫模板，支持一键无感切换。' },
                        { icon: '⚡', title: '极速加载', desc: '独家 CDN 加速，无论是图片还是 4K 视频均可秒开。' },
                        { icon: '🔗', title: '专属域名', desc: '拥有自定义二级域名，甚至可以绑定您的独立域名。' },
                        { icon: '💎', title: '尊贵标识', desc: '全平台尊贵会员标识，头像框及个人主页深度定制。' },
                    ].map((b, idx) => (
                        <div key={idx} className="glass-card bg-surface-container-low/30 backdrop-blur-md border border-outline-variant/10 p-6 rounded-3xl hover:bg-surface-container-low/50 hover:-translate-y-1 transition-all duration-300">
                            <div className="text-3xl md:text-4xl mb-4">{b.icon}</div>
                            <h3 className="font-headline text-lg font-medium mb-2">{b.title}</h3>
                            <p className="text-sm text-on-surface-variant leading-relaxed">{b.desc}</p>
                        </div>
                    ))}
                </div>
                
                {/* --- Pricing Grid --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch mb-20">
                    {/* Free Tier (Static Comparison) */}
                    <div className="glass-card flex flex-col bg-surface-container-low/20 backdrop-blur-xl border border-outline-variant/20 rounded-[2rem] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:border-outline-variant/40 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                        <div className="text-center mb-8">
                            <h2 className="font-headline text-2xl font-medium mb-2">体验用户</h2>
                            <p className="text-on-surface-variant text-sm font-light">基础功能 · 永久免费</p>
                        </div>
                        
                        <div className="text-center py-8 border-y border-outline-variant/10 mb-8">
                            <div className="text-5xl lg:text-6xl font-headline font-light tracking-tight mb-4 flex justify-center items-start">
                                <span className="text-xl lg:text-2xl mt-2 mr-1">¥</span>0
                            </div>
                            <div className="inline-block px-4 py-1.5 rounded-lg bg-surface-container border border-outline-variant/10 text-on-surface-variant text-xs font-medium">
                                无需支付，立即开始
                            </div>
                        </div>
                        
                        <div className="flex-1 mb-10">
                            <div className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-6">基础权限：</div>
                            <ul className="space-y-4">
                                {[
                                    { l: '精选免费模板库', p: true },
                                    { l: '1 个专属域名配额', p: true },
                                    { l: '每日 5 次修改限制', p: true },
                                    { l: '标准 CDN 加载速度', p: true },
                                    { l: '支持 480+ BGM 库', p: true },
                                    { l: '移除底部版权标识', p: false },
                                    { l: '高级粒子特效定制', p: false },
                                ].map((item, i) => (
                                    <li key={i} className={`flex items-start gap-3 ${item.p ? '' : 'opacity-30'}`}>
                                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] mt-0.5 ${item.p ? 'bg-surface-variant text-on-surface' : 'bg-surface-container-highest/50 text-outline'}`}>
                                            {item.p ? '✓' : '✕'}
                                        </span>
                                        <span className={`text-sm font-light ${!item.p && 'line-through'}`}>{item.l}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button 
                            onClick={() => navigate('/builder')}
                            className="w-full py-4 rounded-xl font-medium bg-surface-variant text-on-surface border border-outline-variant/20 hover:bg-surface-container-high transition-colors"
                        >
                            免费开始制作
                        </button>
                    </div>

                    {[...configs]
                        .sort((a, b) => (a.limit || 0) - (b.limit || 0))
                        .map(c => {
                        const isPro = c.tier === 'pro';
                        const isPartner = c.tier === 'partner';
                        const isLifetime = c.tier === 'lifetime';

                        const accentColorHex = c.accentColor || (isPro ? '#e879f9' : '#818cf8'); // primary vs secondary
                        const gradientFrom = isPro ? 'from-primary' : 'from-secondary';
                        const gradientTo = isPro ? 'to-primary-container' : 'to-secondary-container';
                        
                        return (
                            <div key={c.id} className={`glass-card flex flex-col relative bg-surface-container-low/30 backdrop-blur-xl rounded-[2rem] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                                isPro ? 'border border-primary/40 shadow-[0_0_30px_rgba(224,142,254,0.15)] ring-1 ring-primary/20' : 
                                isPartner || isLifetime ? 'border border-secondary/40 shadow-[0_0_30px_rgba(129,140,248,0.15)] ring-1 ring-secondary/20' : 
                                'border border-outline-variant/20'
                            }`}>
                                {c.discount_label && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <div className={`text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-[0_10px_20px_rgba(0,0,0,0.2)] whitespace-nowrap bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
                                            🔥 {c.discount_label}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="text-center mb-8">
                                    <h2 className="font-headline text-2xl font-medium mb-2">{c.display_name || c.tier.toUpperCase()}</h2>
                                    <p className="text-on-surface-variant text-sm font-light">全项权益 · {c.duration_months} 个月有效期</p>
                                </div>
                                
                                <div className="text-center py-8 border-y border-outline-variant/10 mb-8">
                                    <div className="line-through text-outline text-lg mb-1">
                                        ¥ {(c.base_price / 100).toFixed(2)}
                                    </div>
                                    <div className="text-5xl lg:text-6xl font-headline font-light tracking-tight mb-4 flex justify-center items-start text-on-surface">
                                        <span className="text-xl lg:text-2xl mt-2 mr-1">¥</span>
                                        {c.is_renewal 
                                            ? (c.renewal_price / 100).toFixed(2) 
                                            : (c.is_returning 
                                                ? (c.base_price / 100).toFixed(2) 
                                                : (c.first_month_price / 100).toFixed(2))
                                        }
                                    </div>
                                    <div className={`inline-block px-4 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm`}
                                         style={{ backgroundColor: accentColorHex }}>
                                        {c.is_renewal 
                                            ? '您当前的续费特惠价' 
                                            : (c.is_returning 
                                                ? '当前等级标准价格' 
                                                : `首月入坑价 (次月 ¥${(c.renewal_price / 100).toFixed(2)} 续费)`)
                                        }
                                    </div>
                                </div>
                                
                                <div className="flex-1 mb-10">
                                    <div className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-6">等级核心权益：</div>
                                    <ul className="space-y-4">
                                        {((Array.isArray(c.features) && c.features.length > 0) ? c.features : [
                                            { text: '100% 模板库自由切换', active: true },
                                            { text: `${isPro ? '3' : isPartner ? '10' : '99'} 个域名配额`, active: true },
                                            { text: '专属 7x24h 技术支持', active: isPartner || isLifetime },
                                            { text: '全库 480+ 款无损 BGM 库', active: true },
                                            { text: '动态粒子特效背景自由定制', active: true },
                                            { text: '支持绑定个人顶级域名', active: isPartner || isLifetime },
                                        ]).map((item, i) => (
                                            <li key={i} className={`flex items-start gap-3 ${item.active !== false ? '' : 'opacity-30'}`}>
                                                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] mt-0.5 text-white ${!item.active ? 'bg-surface-container-highest/50 !text-outline' : ''}`}
                                                      style={{ backgroundColor: item.active !== false ? accentColorHex : undefined }}>
                                                    {item.active !== false ? '✓' : '✕'}
                                                </span>
                                                <span className={`text-sm font-light ${item.active === false && 'line-through'}`}>{item.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button 
                                    disabled={!!payingId}
                                    onClick={() => handleCheckout(c, 'wechat')}
                                    className={`w-full py-4 rounded-xl font-medium text-white transition-all duration-300 shadow-[0_10px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_25px_rgba(0,0,0,0.3)] hover:-translate-y-1 bg-gradient-to-br ${gradientFrom} ${gradientTo} disabled:opacity-70 disabled:cursor-not-allowed`}
                                >
                                    {payingId === c.id ? '正在唤起支付...' : (c.is_renewal ? '立即续费特权' : '立即开启特权')}
                                </button>
                                <p className="text-center text-[10px] text-on-surface-variant mt-3 opacity-80">
                                    安全加密支付 · 权益秒到账
                                </p>
                            </div>
                        );
                    })}
                </div>
                
                {/* --- FAQ / Footer --- */}
                <div className="mt-16 pt-12 border-t border-outline-variant/10 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                            <h4 className="font-headline text-xl font-medium mb-6">常见问题解答</h4>
                            <div className="space-y-6">
                                <div>
                                    <div className="font-medium text-on-surface mb-2">Q: 升级后原来的项目会丢失吗？</div>
                                    <div className="text-sm text-on-surface-variant font-light leading-relaxed">绝对不会。升级只会增加您的创作上限并解锁新功能，原有内容将完美保留并支持直接升级至高级模板。</div>
                                </div>
                                <div>
                                    <div className="font-medium text-on-surface mb-2">Q: 支持哪些支付方式？</div>
                                    <div className="text-sm text-on-surface-variant font-light leading-relaxed">目前全面支持微信支付。支付过程受商户网关加密保护，确保您的资金安全。</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-headline text-xl font-medium mb-6">VIP 专属服务</h4>
                            <div className="glass-card bg-surface-container-low/20 backdrop-blur-md border border-outline-variant/10 p-6 rounded-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                                <p className="text-sm text-on-surface-variant font-light mb-4 leading-relaxed relative z-10">
                                    遇到支付问题、权益未即时到账或有定制化需求？请随时联系我们的快速响应客服：
                                </p>
                                <div className="text-base font-medium text-primary mb-1 relative z-10">
                                    微信号: <span className="underline decoration-primary/30 underline-offset-4">MoodSpaceSupport</span>
                                </div>
                                <div className="text-xs text-outline relative z-10">
                                    (服务时间: 10:00 - 22:00)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center text-outline text-xs mt-8 opacity-60">
                    © 2026 RomanceSpace · 让浪漫不再有边界
                </div>
            </div>
        </div>
    );
}
