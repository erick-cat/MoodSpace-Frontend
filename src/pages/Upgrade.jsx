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

    useEffect(() => {
        if (orderNoParam) {
            // Polling Mode (Redirected from ZhifuFM)
            setLoading(false);
            const interval = setInterval(async () => {
                try {
                    // Assuming API is accessible relative if proxy is set, or absolute
                    const url = `${import.meta.env.VITE_API_URL || ''}/api/payment/query?order_no=${orderNoParam}`;
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
            const url = `${import.meta.env.VITE_API_URL || ''}/api/payment/pricing`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setConfigs(data.data);
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
            const url = `${import.meta.env.VITE_API_URL || ''}/api/payment/create`;
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
                // Redirect completely to the gateway
                window.location.href = data.payUrl;
            } else {
                toast.error(data.error || '创建订单失败');
                setPaying(false);
            }
        } catch (e) {
            toast.error('网络请求失败');
            setPaying(false);
        }
    };

    if (loading) return <div className="page-container"><div className="spinner"></div></div>;

    // Render Polling View
    if (orderNoParam) {
        return (
            <div className="page-container" style={{ textAlign: 'center', paddingTop: '10vh' }}>
                <h2>订单状态追踪 🚀</h2>
                <div style={{ margin: '30px 0', fontSize: '18px', color: '#555' }}>
                    {pollStatus}
                </div>
                {!isSuccess && <div className="spinner" style={{ margin: '0 auto' }}></div>}
            </div>
        );
    }

    // Render Pricing View
    return (
        <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>解锁全部特权 💎</h1>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                {configs.map(c => (
                    <div key={c.id} style={{
                        border: '2px solid #fee2e2', borderRadius: '16px', padding: '30px',
                        background: '#fff', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                    }}>
                        <h2 style={{ textTransform: 'capitalize', color: '#e11d48' }}>{c.tier}</h2>
                        <h4 style={{ color: '#888' }}>{c.duration_months} / 月</h4>
                        <div style={{ margin: '20px 0', fontSize: '28px', fontWeight: 'bold' }}>
                            ¥ {(c.base_price / 100).toFixed(2)}
                        </div>
                        {c.discount_rate < 1 && (
                            <div style={{ color: '#10b981', fontSize: '14px', marginBottom: '15px' }}>
                                限时折扣: {(c.discount_rate * 10).toFixed(1)} 折
                                <br />只需: ¥ {((c.base_price * c.discount_rate) / 100).toFixed(2)}
                            </div>
                        )}
                        <button 
                            disabled={paying}
                            onClick={() => handleCheckout(c, 'wechat')}
                            style={{ 
                                width: '100%', padding: '12px', background: '#e11d48', color: '#fff', 
                                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            {paying ? '正在生成...' : '立即购买 (微信/支付宝)'}
                        </button>
                    </div>
                ))}
            </div>
            
            {configs.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999' }}>暂无开放的购买套餐</div>
            )}
        </div>
    );
}
