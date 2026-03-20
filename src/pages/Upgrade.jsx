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
        <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '16px' }}>解锁全部特权 💎</h1>
                <p style={{ fontSize: '1.1rem', color: '#64748b' }}>一次订阅，畅享情感空间的无限可能</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
                {configs.map(c => {
                    const isPro = c.tier === 'pro';
                    return (
                        <div key={c.id} style={{
                            border: isPro ? '2px solid var(--pink)' : '1px solid #e2e8f0', 
                            borderRadius: '24px', 
                            padding: '40px 30px',
                            background: '#fff', 
                            textAlign: 'center', 
                            boxShadow: isPro ? 'var(--shadow-lg)' : '0 10px 20px rgba(0,0,0,0.02)',
                            position: 'relative',
                            transition: 'transform 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            {c.discount_label && (
                                <div style={{
                                    position: 'absolute', top: '20px', right: '20px',
                                    background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                                    color: '#fff', padding: '4px 12px', borderRadius: '20px',
                                    fontSize: '0.75rem', fontWeight: 800, boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)'
                                }}>
                                    {c.discount_label}
                                </div>
                            )}
                            
                            <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '8px' }}>{c.display_name || c.tier.toUpperCase()}</h2>
                            <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '0.9rem' }}>
                                有效期 {c.duration_months} 个月
                            </p>
                            
                            <div style={{ marginBottom: '30px' }}>
                                <div style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '1rem', marginBottom: '4px' }}>
                                    ¥ {(c.base_price / 100).toFixed(2)}
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: '#1e293b' }}>
                                    <span style={{ fontSize: '1.5rem' }}>¥</span>
                                    {c.is_renewal ? (c.renewal_price / 100).toFixed(2) : (c.first_month_price / 100).toFixed(2)}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '8px' }}>
                                    {c.is_renewal ? '您的专享续费价' : `次月起续费 ¥${(c.renewal_price / 100).toFixed(2)}/月`}
                                </div>
                            </div>
                            
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', textAlign: 'left', fontSize: '0.95rem', color: '#475569' }}>
                                <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: 'var(--pink)' }}>✓</span> 无限次模板切换
                                </li>
                                <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: 'var(--pink)' }}>✓</span> 专属高级动态背景
                                </li>
                                <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: 'var(--pink)' }}>✓</span> 背景音乐库全解锁
                                </li>
                                <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: 'var(--pink)' }}>✓</span> 独立二级域名访问
                                </li>
                            </ul>

                            <button 
                                disabled={paying}
                                onClick={() => handleCheckout(c, 'wechat')}
                                className={isPro ? "btn btn--primary" : "btn btn--outline"}
                                style={{ 
                                    width: '100%', padding: '15px', borderRadius: '15px', 
                                    fontSize: '1rem', fontWeight: 700, transition: 'all 0.2s ease'
                                }}
                            >
                                {paying ? '正在唤起支付...' : (c.is_renewal ? '立即续费特权' : '立即开启特权')}
                            </button>
                        </div>
                    );
                })}
            </div>
            
            {configs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '24px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✨</div>
                    <h3>套餐整理中，敬请期待...</h3>
                </div>
            )}

            <div style={{ marginTop: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                如有支付问题请联系客服微信号: MoodSpaceSupport
            </div>
        </div>
    );
}
