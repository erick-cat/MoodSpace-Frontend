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
    const [paying, setPaying] = useState(false);
    
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
        setPaying(true);
        try {
            const url = `${API_BASE}/api/payment/create`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
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
                setPaying(false);
            }
        } catch (e) {
            toast.error('网络请求失败');
            setPaying(false);
        }
    };

    if (loading) return <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><div className="spinner"></div></div>;

    // Render Polling View
    if (orderNoParam) {
        return (
            <div className="page-container" style={{ textAlign: 'center', padding: '100px 20px', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>{isSuccess ? '✅' : '⏳'}</div>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.8rem' }}>订单状态追踪</h2>
                    <div style={{ margin: '20px 0', fontSize: '1.1rem', color: '#64748b', lineHeight: 1.6 }}>
                        {pollStatus}
                    </div>
                    {!isSuccess && <div className="spinner" style={{ margin: '30px auto' }}></div>}
                    {isSuccess && (
                        <button 
                            onClick={() => navigate('/myspace')} 
                            className="btn btn--primary" 
                            style={{ marginTop: '20px', padding: '12px 30px' }}
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
        <div className="page-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 20px' }}>
            {/* --- Hero Section --- */}
            <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                <div style={{ 
                    display: 'inline-block', padding: '10px 24px', borderRadius: '100px', 
                    background: 'var(--pink-light)', color: 'var(--pink)', 
                    fontSize: '0.9rem', fontWeight: 800, marginBottom: '20px',
                    boxShadow: '0 4px 15px rgba(214, 51, 108, 0.1)'
                }}>
                    ✨ 开启您的专属浪漫空间
                </div>
                <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 900, color: '#1e293b', marginBottom: '20px', letterSpacing: '-1px' }}>
                    选择最适合您的 <span style={{ color: 'var(--pink)', background: 'linear-gradient(120deg, #fce7f3 0%, #fce7f3 100%)', backgroundRepeat: 'no-repeat', backgroundSize: '100% 0.3em', backgroundPosition: '0 0.8em' }}>特权等级</span>
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
                    加入 Pro 会员或合伙人计划，解锁无限创意模板与专属自定义功能，让每一个浪漫时刻都值得被永久铭记。
                </p>
            </div>

            {/* --- Benefit Highlights --- */}
            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '24px', marginBottom: '80px' 
            }}>
                {[
                    { icon: '🎨', title: '无限模板', desc: '解锁全场 100+ 精致浪漫模板，支持一键无感切换。' },
                    { icon: '⚡', title: '极速加载', desc: '独家 CDN 加速，无论是图片还是 4K 视频均可秒开。' },
                    { icon: '🔗', title: '专属域名', desc: '拥有自定义二级域名，甚至可以绑定您的独立域名。' },
                    { icon: '💎', title: '尊贵标识', desc: '全平台尊贵会员标识，头像框及个人主页深度定制。' },
                ].map((b, idx) => (
                    <div key={idx} style={{ 
                        background: '#fff', padding: '30px', borderRadius: '24px', 
                        border: '1px solid #f1f5f9', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' 
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>{b.icon}</div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>{b.title}</h3>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>{b.desc}</p>
                    </div>
                ))}
            </div>
            
            {/* --- Pricing Grid --- */}
            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '30px', alignItems: 'stretch'
            }}>
                {/* Free Tier (Static Comparison) */}
                <div style={{
                    border: '2px solid #e2e8f0', 
                    borderRadius: '32px', 
                    padding: '50px 40px',
                    background: '#fff', 
                    textAlign: 'center', 
                    boxShadow: '0 10px 20px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.4s ease'
                }}>
                    <div style={{ marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                            体验用户
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>
                            基础功能 · 永久免费
                        </p>
                    </div>
                    
                    <div style={{ margin: '40px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '30px 0' }}>
                        <div style={{ fontSize: '4.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-2px' }}>
                            <span style={{ fontSize: '1.8rem', verticalAlign: 'top', marginTop: '15px', display: 'inline-block' }}>¥</span>
                            0
                        </div>
                        <div style={{ 
                            display: 'inline-block', padding: '4px 12px', borderRadius: '8px',
                            background: '#f1f5f9', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginTop: '10px'
                        }}>
                            无需支付，立即开始
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'left', marginBottom: '40px', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            基础权限:
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '1rem', color: '#475569' }}>
                            {[
                                { l: '精选免费模板库', p: true },
                                { l: '1 个专属域名配额', p: true },
                                { l: '每日 5 次修改限制', p: true },
                                { l: '标准 CDN 加载速度', p: true },
                                { l: '支持 480+ BGM 库', p: true },
                                { l: '移除底部版权标识', p: false },
                                { l: '高级粒子特效定制', p: false },
                            ].map((item, i) => (
                                <li key={i} style={{ 
                                    marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px',
                                    opacity: item.p ? 1 : 0.35
                                }}>
                                    <span style={{ 
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        background: item.p ? '#94a3b8' : '#cbd5e1',
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '10px', marginTop: '4px', flexShrink: 0
                                    }}>{item.p ? '✓' : '✕'}</span>
                                    <span style={{ textDecoration: item.p ? 'none' : 'line-through' }}>{item.l}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button 
                        onClick={() => navigate('/builder')}
                        style={{ 
                            width: '100%', padding: '20px', borderRadius: '20px', 
                            fontSize: '1.2rem', fontWeight: 800, transition: 'all 0.3s ease',
                            background: '#f1f5f9', color: '#64748b', border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        免费开始制作
                    </button>
                </div>

                {configs.map(c => {
                    const isPro = c.tier === 'pro';
                    const isPartner = c.tier === 'partner';
                    const isLifetime = c.tier === 'lifetime';

                    // Color Schemes
                    const themeColor = c.color || (isPro ? 'var(--pink)' : isPartner ? '#7c3aed' : '#0f172a');
                    const themeBg = isPro ? '#fff1f2' : isPartner ? '#f5f3ff' : '#f8fafc'; // Keep light background the same structure

                    return (
                        <div key={c.id} style={{
                            border: `2px solid ${isPro ? themeColor : '#e2e8f0'}`, 
                            borderRadius: '32px', 
                            padding: '50px 40px',
                            background: '#fff', 
                            textAlign: 'center', 
                            boxShadow: isPro ? '0 25px 50px -12px rgba(214, 51, 108, 0.15)' : '0 10px 20px rgba(0,0,0,0.02)',
                            position: 'relative',
                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
                            if (isPro) e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(214, 51, 108, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            if (isPro) e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(214, 51, 108, 0.15)';
                        }}
                        >
                            {c.discount_label && (
                                <div style={{
                                    position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                                    background: c.bg || (isPro ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)'),
                                    color: '#fff', padding: '6px 20px', borderRadius: '30px',
                                    fontSize: '0.8rem', fontWeight: 900, boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    🔥 {c.discount_label}
                                </div>
                            )}
                            
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                                    {c.display_name || c.tier.toUpperCase()}
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>
                                    全项权益 · {c.duration_months} 个月有效期
                                </p>
                            </div>
                            
                            <div style={{ margin: '40px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '30px 0' }}>
                                <div style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '1.1rem', marginBottom: '5px' }}>
                                    ¥ {(c.base_price / 100).toFixed(2)}
                                </div>
                                <div style={{ fontSize: '4.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-2px' }}>
                                    <span style={{ fontSize: '1.8rem', verticalAlign: 'top', marginTop: '15px', display: 'inline-block' }}>¥</span>
                                    {c.is_renewal 
                                        ? (c.renewal_price / 100).toFixed(2) 
                                        : (c.is_returning 
                                            ? (c.base_price / 100).toFixed(2) 
                                            : (c.first_month_price / 100).toFixed(2))
                                    }
                                </div>
                                <div style={{ 
                                    display: 'inline-block', padding: '4px 12px', borderRadius: '8px',
                                    background: themeBg, color: themeColor, fontSize: '0.85rem', fontWeight: 700, marginTop: '10px'
                                }}>
                                    {c.is_renewal 
                                        ? '您当前的续费特惠价' 
                                        : (c.is_returning 
                                            ? '当前等级标准价格' 
                                            : `首月入坑价 (次月 ¥${(c.renewal_price / 100).toFixed(2)} 续费)`)
                                    }
                                </div>
                            </div>
                            
                            <div style={{ textAlign: 'left', marginBottom: '40px', flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    等级核心权益:
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '1rem', color: '#475569' }}>
                                    {(c.features || [
                                        { text: '100% 模板库自由切换', active: true },
                                        { text: `${isPro ? '3' : isPartner ? '10' : '99'} 个域名配额`, active: true },
                                        { text: '专属 7x24h 情感导师技术支持', active: isPartner || isLifetime },
                                        { text: '全库 480+ 款无损 BGM 库', active: true },
                                        { text: '动态粒子特效背景自由定制', active: true },
                                        { text: '支持绑定个人顶级域名', active: isPartner || isLifetime },
                                    ]).map((item, i) => (
                                        <li key={i} style={{ 
                                            marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '12px',
                                            opacity: item.active ? 1 : 0.35
                                        }}>
                                            <span style={{ 
                                                width: '20px', height: '20px', borderRadius: '50%',
                                                background: item.active ? themeColor : '#cbd5e1',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '10px', marginTop: '4px', flexShrink: 0
                                            }}>{item.p ? '✓' : '✕'}</span>
                                            <span style={{ textDecoration: item.p ? 'none' : 'line-through' }}>{item.l}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button 
                                disabled={paying}
                                onClick={() => handleCheckout(c, 'wechat')}
                                style={{ 
                                    width: '100%', padding: '20px', borderRadius: '20px', 
                                    fontSize: '1.2rem', fontWeight: 800, transition: 'all 0.3s ease',
                                    background: themeColor, color: '#fff', border: 'none',
                                    cursor: 'pointer', boxShadow: `0 10px 25px -5px ${themeColor}66`
                                }}
                            >
                                {paying ? '正在唤起支付...' : (c.is_renewal ? '立即续费特权' : '立即开启特权')}
                            </button>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '15px' }}>
                                安全加密支付 · 权益秒到账
                            </p>
                        </div>
                    );
                })}
            </div>
            
            {/* --- FAQ / Footer --- */}
            <div style={{ marginTop: '100px', borderTop: '1px solid #e2e8f0', paddingTop: '60px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '60px', textAlign: 'left' }}>
                    <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '25px' }}>常见问题解答</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Q: 升级后原来的项目会丢失吗？</div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>绝对不会。升级只会增加您的创作上限并解锁新功能，原有内容将完美保留并支持直接升级至高级模板。</div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Q: 支持哪些支付方式？</div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>目前全面支持微信支付。支付过程受商户网关加密保护，确保您的资金安全。</div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '25px' }}>VIP 专属服务</h4>
                        <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                            <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '15px', lineHeight: 1.6 }}>
                                遇到支付问题、权益未即时到账或有定制化需求？请随时联系我们的 12h 快速响应客服：
                            </p>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--pink)' }}>
                                微信号: <span style={{ textDecoration: 'underline' }}>MoodSpaceSupport</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '10px' }}>
                                (服务时间: 10:00 - 22:00)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                © 2026 RomanceSpace · 让浪漫不再有边界
            </div>
        </div>
    );
}
