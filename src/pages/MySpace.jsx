import { useEffect, useState } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { getUserStatus } from '../api/client.js';

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || 'moodspace.xyz';

export default function MySpace() {
    const { user, profile, loading, signOut, setProfile } = useAuth();
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
        maxDailyEdits: 5,
        bg: '#f0e6ee',
        color: 'var(--pink)'
    });
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [inviteCount, setInviteCount] = useState(0);
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [newNickname, setNewNickname] = useState('');

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

    async function handleUpdateNickname() {
        if (!newNickname.trim()) return setIsEditingNickname(false);
        const { error } = await supabase
            .from('profiles')
            .update({ display_name: newNickname.trim() })
            .eq('id', user.id);
        
        if (error) {
            toast.error('修改失败：' + error.message);
        } else {
            toast.success('昵称已更新');
            setIsEditingNickname(false);
            if (setProfile && profile) {
                setProfile({ ...profile, display_name: newNickname.trim() });
            }
        }
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
                    <div className="myspace-username" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isEditingNickname ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input 
                                    className="input" 
                                    style={{ padding: '4px 8px', fontSize: '1rem', width: '120px' }}
                                    value={newNickname}
                                    onChange={e => setNewNickname(e.target.value)}
                                    placeholder="新昵称"
                                    autoFocus
                                />
                                <button className="btn btn--sm btn--primary" onClick={handleUpdateNickname}>保存</button>
                                <button className="btn btn--sm btn--outline" onClick={() => setIsEditingNickname(false)}>取消</button>
                            </div>
                        ) : (
                            <>
                                {profile?.display_name || '探索者'}
                                <button 
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.6 }}
                                    onClick={() => {
                                        setNewNickname(profile?.display_name || '');
                                        setIsEditingNickname(true);
                                    }}
                                    title="修改昵称"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ 
                            background: status.bg,
                            color: status.color,
                            border: 'none'
                        }}>
                            {status.label || profile?.tier?.toUpperCase() || 'FREE'}
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
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                            {/* Domain Quota Card */}
                            <div style={{ 
                                flex: 1, 
                                background: '#f8fafc', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>网页额度</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                    {status.count} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>/ {status.maxDomains}</span>
                                </div>
                                <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', width: `${Math.min(100, (status.count / status.maxDomains) * 100)}%` }} />
                                </div>
                            </div>

                            {/* Daily Edit Quota Card */}
                            <div style={{ 
                                flex: 1, 
                                background: '#f8fafc', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>今日修改</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                    {status.dailyUsedEdits} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>/ {status.maxDailyEdits}</span>
                                </div>
                                <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                                    <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--pink), #f472b6)', width: `${Math.min(100, (status.dailyUsedEdits / status.maxDailyEdits) * 100)}%` }} />
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
                                        🔗 {p.subdomain}.{BASE_DOMAIN}
                                    </span>
                                    <span className="myspace-project-meta">
                                        模板：{p.template_type} ·
                                        更新于 {new Date(p.updated_at || p.created_at).toLocaleDateString('zh-CN')}
                                    </span>
                                </div>
                                <div className="myspace-project-actions">
                                    <a
                                        href={`https://${p.subdomain}.${BASE_DOMAIN}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn--outline btn--sm"
                                    >
                                        访问
                                    </a>
                                    <button 
                                        onClick={() => {
                                            const url = `https://${p.subdomain}.${BASE_DOMAIN}`;
                                            navigator.clipboard.writeText(url);
                                            toast.success('已复制网址到剪贴板！');
                                        }}
                                        className="btn btn--outline btn--sm"
                                        style={{ borderColor: '#dcfce7', color: '#16a34a', background: '#f0fdf4' }}
                                    >
                                        分享🔗
                                    </button>
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
