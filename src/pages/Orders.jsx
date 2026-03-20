import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Orders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        fetchOrders();
    }, [user]);

    const fetchOrders = async () => {
        try {
            // Usually we'd abstract getting user's orders through backend
            // For now assuming we just fetch direct or have an endpoint. Let's assume a backend query:
            // To be secure, we should query a future `/api/payment/my-orders` endpoint.
            // But since we are connected to supabase via UI sometimes, we might fetch it.
            // Ideally:
            const url = `${import.meta.env.VITE_API_URL || ''}/api/payment/history?userId=${user.id}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setOrders(data.data);
            }
        } catch (e) {
            toast.error('历史记录加载失败');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-container"><div className="spinner"></div></div>;

    const translateStatus = (s) => {
        switch(s) {
            case 'pending': return '等待支付';
            case 'paid': return '已支付(处理中)';
            case 'processing': return '处理中';
            case 'success': return '完成';
            case 'failed': return '失败';
            case 'closed': return '已超时关闭';
            default: return s;
        }
    };

    return (
        <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
            <h2>订单中心 📜</h2>
            
            {orders.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    您还没有下过订单哦~
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                            <th style={{ padding: '12px' }}>单号</th>
                            <th style={{ padding: '12px' }}>商品</th>
                            <th style={{ padding: '12px' }}>金额</th>
                            <th style={{ padding: '12px' }}>状态</th>
                            <th style={{ padding: '12px' }}>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(o => (
                            <tr key={o.order_no} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px', fontSize: '13px', color: '#555' }}>{o.order_no}</td>
                                <td style={{ padding: '12px' }}>{o.target_tier} ({o.duration_months}个月)</td>
                                <td style={{ padding: '12px' }}>¥ {(o.actual_amount / 100).toFixed(2)}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ 
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                                        background: o.status === 'success' ? '#dcfce7' : o.status === 'closed' ? '#f1f5f9' : '#fef3c7',
                                        color: o.status === 'success' ? '#166534' : o.status === 'closed' ? '#475569' : '#92400e'
                                    }}>
                                        {translateStatus(o.status)}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', fontSize: '13px', color: '#777' }}>
                                    {new Date(o.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
