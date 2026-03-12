import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const TIER_LABELS = {
    free: { label: '🌟 免费用户', color: '#64748b' },
    pro: { label: '💎 Pro 会员', color: '#7c3aed' },
    lifetime: { label: '👑 终身合伙人', color: '#b45309' },
};

export default function MySpace() {
    const { user, profile, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    // Guard: redirect to auth if not logged in
    useEffect(() => {
        if (!loading && !user) navigate('/auth', { replace: true });
    }, [loading, user, navigate]);

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

    async function handleSignOut() {
        await signOut();
        toast.success('已退出登录');
        navigate('/');
    }

    if (loading || !user) {
        return (
            <div className="spinner-wrap">
                <div className="spinner" />
            </div>
        );
    }

    const tierMeta = TIER_LABELS[profile?.tier ?? 'free'];
    const inviteUrl = profile?.invite_code
        ? `${window.location.origin}/auth?ref=${profile.invite_code}`
        : null;

    return (
        <div className="page container" style={{ maxWidth: 720 }}>
            {/* ── Profile Card ── */}
            <div className="myspace-profile-card">
                <div className="myspace-avatar">
                    {profile?.display_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </div>
                <div className="myspace-profile-info">
                    <h1 className="myspace-username">
                        {profile?.display_name ?? profile?.username ?? user.email}
                    </h1>
                    <span className="myspace-tier" style={{ color: tierMeta.color }}>
                        {tierMeta.label}
                    </span>
                </div>
                <button id="btn-signout" className="btn btn--outline btn--sm" onClick={handleSignOut}>
                    退出
                </button>
            </div>

            {/* ── Invite Code Card ── */}
            {inviteUrl && (
                <div className="myspace-section-card">
                    <h2 className="myspace-section-title">📣 我的推广邀请码</h2>
                    <p className="myspace-section-desc">
                        分享以下链接，邀请朋友注册。被邀请者首次发布网页后，你将获得额外修改次数奖励。
                    </p>
                    <div className="myspace-invite-box">
                        <code id="invite-code-display" className="myspace-invite-code">{profile.invite_code}</code>
                        <button
                            id="btn-copy-invite"
                            className="btn btn--outline btn--sm"
                            onClick={() => {
                                navigator.clipboard.writeText(inviteUrl);
                                toast.success('邀请链接已复制！');
                            }}
                        >
                            复制链接
                        </button>
                    </div>
                </div>
            )}

            {/* ── My Projects ── */}
            <div className="myspace-section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="myspace-section-title" style={{ marginBottom: 0 }}>🌐 我的专属网页</h2>
                    <Link to="/builder" className="btn btn--primary btn--sm" id="btn-create-new">
                        + 新建
                    </Link>
                </div>

                {loadingProjects && <div className="spinner-wrap"><div className="spinner" /></div>}

                {!loadingProjects && projects.length === 0 && (
                    <div className="alert alert--info">
                        你还没有创建过任何网页。
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
                                        更新于 {new Date(p.updated_at).toLocaleDateString('zh-CN')}
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
                                    <Link
                                        to={`/builder/${p.template_type}?edit=${p.subdomain}`}
                                        className="btn btn--primary btn--sm"
                                        id={`btn-edit-${p.subdomain}`}
                                    >
                                        编辑
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Upgrade hint for free users ── */}
            {profile?.tier === 'free' && (
                <div className="myspace-upgrade-hint">
                    <span>💡 免费用户限 1 个域名，每天最多修改 3 次。升级 Pro 享受更多特权。</span>
                    <a href="#" className="btn btn--primary btn--sm" style={{ marginLeft: '1rem' }}>
                        升级 Pro
                    </a>
                </div>
            )}
        </div>
    );
}
