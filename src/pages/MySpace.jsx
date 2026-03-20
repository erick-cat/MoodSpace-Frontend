import { useEffect, useState } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { getUserStatus } from '../api/client.js';

export default function MySpace() {
    const { user, profile, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [localInviteCode, setLocalInviteCode] = useState(null);
    const [status, setStatus] = useState({ 
        count: 0, 
        maxDomains: 1, 
        tier: 'free',
        label: '🌟 体验用户',
        dailyUsedEdits: 0,
        maxDailyEdits: 5
    });
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [inviteCount, setInviteCount] = useState(0);

    // Guard: redirect to auth if not logged in
    useEffect(() => {
        if (!loading && !user) navigate('/auth', { replace: true });
    }, [loading, user, navigate]);

    // Fetch Invite Count from profiles
    useEffect(() => {
        if (!user) return;
        supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('invited_by', user.id)
            .then(({ count, error }) => {
                if (!error) setInviteCount(count || 0);
            });
    }, [user]);

    // Sync local invite code from profile
    useEffect(() => {
        if (profile?.invite_code) setLocalInviteCode(profile.invite_code);
    }, [profile]);

    // Load this user's projects from Supabase
    useEffect(() => {
        if (!user) return;
        supabase
            .from('projects')
            .select('subdomain, template_type, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) toast.error('加载项目失败：' + error.message);
                else setProjects(data ?? []);
                setLoadingProjects(false);
            });
    }, [user]);

    // Load user quota status from backend
    // L6.7 Sync status whenever profile tier or expiry changes (Realtime reactive)
    useEffect(() => {
        if (!user) return;
        getUserStatus(user.id)
            .then(res => {
                if (res.success) {
                    setStatus(res.data);
                }
            })
            .catch(err => console.error('[Quota Fetch Error]', err))
            .finally(() => setLoadingStatus(false));
    }, [user, profile?.tier, profile?.subscription_expires_at]);

    async function handleSignOut() {
        await signOut();
        toast.success('已退出登录');
        navigate('/');
    }

    /**
     * Generate an invite code for users who registered before codes were introduced.
     * Uses the first 8 chars of their UUID.
     */
    async function handleGenerateCode() {
        setGeneratingCode(true);
        const code = user.id.slice(0, 8).toUpperCase();
        const { error } = await supabase
            .from('profiles')
            .update({ invite_code: code })
            .eq('id', user.id);
        if (error) {
            toast.error('生成失败：' + error.message);
        } else {
            setLocalInviteCode(code);
            toast.success('邀请码已生成！');
        }
        setGeneratingCode(false);
    }

    if (loading || !user) {
        return (
            <div className="spinner-wrap">
                <div className="spinner" />
            </div>
        );
    }

    const inviteCode = localInviteCode;
    const inviteUrl = inviteCode
        ? `${window.location.origin}/auth?ref=${inviteCode}`
        : null;

    return (
        <div className="page container" style={{ maxWidth: 720 }}>
            {/* ── Profile Card ── */}
            <div className="myspace-profile-card">
                <div className="myspace-avatar">
                    {profile?.display_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </div>
                <div className="myspace-profile-info">
                    <div className="myspace-username">
                        {profile?.display_name || '探索者'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ 
                            background: profile?.tier === 'pro' ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 
                                        profile?.tier === 'partner' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : '#f0e6ee',
                            color: (profile?.tier === 'pro' || profile?.tier === 'partner') ? '#fff' : 'var(--pink)',
                            border: 'none'
                        }}>
                            {profile?.tier?.toUpperCase() || 'FREE'}
                        </span>
                        {profile?.subscription_expires_at && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {new Date(profile.subscription_expires_at) > new Date() ? '有效期至：' : '已于 '}
                                {new Date(profile.subscription_expires_at).toLocaleDateString()}
                                {new Date(profile.subscription_expires_at) < new Date() && ' 到期'}
                            </span>
                        )}
                        <NavLink 
                            to="/upgrade" 
                            className="btn btn--sm" 
                            style={{ 
                                padding: '4px 12px', 
                                fontSize: '0.75rem', 
                                background: 'var(--pink-light)', 
                                color: 'var(--pink)',
                                border: '1px solid var(--pink)',
                                marginLeft: '4px'
                            }}
                        >
                            {profile?.tier === 'free' || !profile?.tier ? '🚀 升级特权' : '💎 立即续费'}
                        </NavLink>
                    </div>
                    
                    {!loadingStatus && (
                        <div className="myspace-quota-section-compact" style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                            {/* Domain Quota */}
                            <div className="quota-group-mini" style={{ flex: 1 }}>
                                <div className="quota-label-mini" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', color: '#64748b' }}>
                                    <span>网页额度: {status.count}/{status.maxDomains}</span>
                                </div>
                                <div className="quota-bar-bg-mini" style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div 
                                        className="quota-bar-fill" 
                                        style={{ 
                                            height: '100%', 
                                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', 
                                            width: `${Math.min(100, (status.count / status.maxDomains) * 100)}%` 
                                        }} 
                                    />
                                </div>
                            </div>

                            {/* Daily Edit Quota */}
                            <div className="quota-group-mini" style={{ flex: 1 }}>
                                <div className="quota-label-mini" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', color: '#64748b' }}>
                                    <span>今日修改: {status.dailyUsedEdits}/{status.maxDailyEdits}</span>
                                </div>
                                <div className="quota-bar-bg-mini" style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div 
                                        className="quota-bar-fill" 
                                        style={{ 
                                            height: '100%', 
                                            background: 'linear-gradient(90deg, var(--pink), #f472b6)', 
                                            width: `${Math.min(100, (status.dailyUsedEdits / status.maxDailyEdits) * 100)}%` 
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <button id="btn-signout" className="btn btn--outline btn--sm" onClick={handleSignOut}>
                    退出
                </button>
            </div>

            {/* ── Invite & Projects ── */}
            <div className="grid" style={{ gap: '1rem', gridTemplateColumns: '1fr' }}>
                {/* Invite Section */}
                <div className="myspace-section-card" style={{ padding: '1.25rem', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h2 className="myspace-section-title" style={{ margin: 0, fontSize: '0.95rem' }}>📣 专属邀请码</h2>
                        {inviteCode && (
                            <button
                                id="btn-copy-invite"
                                className="badge"
                                style={{ border: 'none', cursor: 'pointer', padding: '4px 12px' }}
                                onClick={() => {
                                    navigator.clipboard.writeText(inviteUrl);
                                    toast.success('链接已复制');
                                }}
                            >
                                点击复制
                            </button>
                        )}
                    </div>
                    
                    {inviteCode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="myspace-invite-box" style={{ background: 'var(--pink-light)', border: 'none', padding: '0.5rem 1rem' }}>
                                <code id="invite-code-display" className="myspace-invite-code" style={{ fontSize: '1.1rem', color: 'var(--pink)', letterSpacing: '2px' }}>{inviteCode}</code>
                            </div>
                            
                            {/* Invite Dashboard */}
                            <div className="invite-dashboard" style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                                <div style={{ flex: 1, background: '#f8fafc', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: 'var(--pink)', fontWeight: 'bold', fontSize: '14px' }}>{inviteCount}</div>
                                    <div>已成功邀请</div>
                                </div>
                                <div style={{ flex: 1, background: '#f8fafc', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px' }}>+{inviteCount}</div>
                                    <div>累计奖励额度</div>
                                </div>
                            </div>
                            
                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                                💡 奖励说明：每成功邀请一位新用户加入，您将获得 +1 网页创建额度奖励。
                            </p>
                        </div>
                    ) : (
                        <button
                            id="btn-generate-code"
                            className="btn btn--primary btn--sm"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={handleGenerateCode}
                            disabled={generatingCode}
                        >
                            {generatingCode ? '生成中...' : '✨ 生成我的邀请码'}
                        </button>
                    )}
                </div>

            {/* ── My Projects ── */}
            <div className="myspace-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="myspace-section-title" style={{ marginBottom: 0 }}>🌐 我制作的网页</h2>
                    <Link to="/builder" className="btn btn--primary btn--sm" id="btn-create-new">
                        + 新建
                    </Link>
                </div>

                {loadingProjects && <div className="spinner-wrap"><div className="spinner" /></div>}

                {projects.length > status.maxDomains && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: '1.4' }}>
                            <strong>账户已进入维护模式：</strong><br/>
                            由于配额到期（当前 {projects.length}/{status.maxDomains}），部分项目已锁定。锁定项目的域名<strong>即将进入释放倒计时</strong>。请及时续费以保护您的专属域名。
                        </div>
                    </div>
                )}

                {!loadingProjects && projects.length === 0 && (
                    <div className="alert alert--info">
                        暂未制作过网页。
                        <Link to="/gallery" style={{ marginLeft: '0.5rem', color: '#1d4ed8', fontWeight: 600 }}>
                            去挑选模板 →
                        </Link>
                    </div>
                )}

                {!loadingProjects && projects.length > 0 && (
                    <div className="myspace-projects-list">
                        {projects.map(p => (
                            <div key={p.subdomain} className="myspace-project-row">
                                <div className="myspace-project-info">
                                    <span className="myspace-project-domain" id={`domain-${p.subdomain}`}>
                                        🔗 {p.subdomain}.885201314.xyz
                                    </span>
                                    <span className="myspace-project-meta">
                                        模板：{p.template_type} ·
                                        更新于 {new Date(p.updated_at || p.created_at).toLocaleDateString('zh-CN')}
                                    </span>
                                </div>
                                <div className="myspace-project-actions">
                                    <a
                                        href={`https://${p.subdomain}.885201314.xyz`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn--outline btn--sm"
                                    >
                                        访问
                                    </a>
                                    {projects.length > status.maxDomains && projects.indexOf(p) !== 0 ? (
                                        <button className="btn btn--sm" style={{ background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }} disabled>
                                            🛑 已锁定
                                        </button>
                                    ) : (
                                        <Link
                                            to={`/builder/${p.template_type}?edit=${p.subdomain}`}
                                            className="btn btn--primary btn--sm"
                                            id={`btn-edit-${p.subdomain}`}
                                        >
                                            编辑
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div> {/* This closes the <div className="grid"> */}

            {/* ── Upgrade hint for free users ── */}
            {profile?.tier === 'free' && (
                <div className="myspace-upgrade-hint">
                    <span>💡 体验用户限制作 {status?.maxDomains || 1} 个专属网页，每天最多修改 {status?.maxDailyEdits || 5} 次内容。升级高级会员以享受无限可能。</span>
                    <Link to="/upgrade" className="btn btn--primary btn--sm" style={{ marginLeft: '1rem' }}>
                        立即升级
                    </Link>
                </div>
            )}
        </div>
    );
}
