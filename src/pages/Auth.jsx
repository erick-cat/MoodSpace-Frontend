import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Single page: handles Register, Login, and Magic Link modes. */
export default function Auth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const [tab, setTab] = useState('login'); // 'login' | 'register' | 'magic'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState(searchParams.get('ref') ?? '');
    const [loading, setLoading] = useState(false);
    const [magicSent, setMagicSent] = useState(false);

    // If already logged in, redirect to MySpace
    useEffect(() => {
        if (user) navigate('/my-space', { replace: true });
    }, [user, navigate]);

    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
        else {
            toast.success('登录成功！');
            navigate('/my-space');
        }
        setLoading(false);
    }

    async function handleRegister(e) {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
        }

        // If invite code provided, record it in profile
        if (inviteCode && data.user) {
            // Find the inviter's profile by their invite_code
            const { data: inviter } = await supabase
                .from('profiles')
                .select('id')
                .eq('invite_code', inviteCode.trim().toUpperCase())
                .maybeSingle();

            if (inviter) {
                await supabase
                    .from('profiles')
                    .update({ invited_by: inviter.id })
                    .eq('id', data.user.id);
            }
        }

        // Also generate this new user a unique invite_code
        if (data.user) {
            const myCode = data.user.id.slice(0, 8).toUpperCase();
            await supabase.from('profiles').update({ invite_code: myCode }).eq('id', data.user.id);
        }

        toast.success('注册成功！请查收验证邮件后登录。');
        setTab('login');
        setLoading(false);
    }

    async function handleMagicLink(e) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/my-space` },
        });
        if (error) toast.error(error.message);
        else setMagicSent(true);
        setLoading(false);
    }

    return (
        <div className="page container" style={{ maxWidth: 460 }}>
            <div className="auth-card">
                <div className="auth-logo">💕</div>
                <h1 className="auth-title">RomanceSpace</h1>
                <p className="auth-sub">登录后即可永久保存你的浪漫网页</p>

                {/* Tab switcher */}
                <div className="auth-tabs">
                    <button
                        id="tab-login"
                        className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                        onClick={() => setTab('login')}
                    >登录</button>
                    <button
                        id="tab-register"
                        className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                        onClick={() => setTab('register')}
                    >注册</button>
                    <button
                        id="tab-magic"
                        className={`auth-tab ${tab === 'magic' ? 'active' : ''}`}
                        onClick={() => setTab('magic')}
                    >魔法链接</button>
                </div>

                {/* ── Login Form ── */}
                {tab === 'login' && (
                    <form onSubmit={handleLogin} id="form-login">
                        <div className="form-group">
                            <label htmlFor="login-email">邮箱</label>
                            <input id="login-email" type="email" value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="你的邮箱地址" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="login-password">密码</label>
                            <input id="login-password" type="password" value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="请输入密码" required />
                        </div>
                        <button id="btn-login-submit" type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                            {loading ? '登录中...' : '🔑 立即登录'}
                        </button>
                    </form>
                )}

                {/* ── Register Form ── */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} id="form-register">
                        <div className="form-group">
                            <label htmlFor="reg-email">邮箱</label>
                            <input id="reg-email" type="email" value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="你的邮箱地址" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-password">密码</label>
                            <input id="reg-password" type="password" value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="至少 8 位" minLength={8} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-invite">邀请码（选填）</label>
                            <input id="reg-invite" type="text" value={inviteCode}
                                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                placeholder="朋友的邀请码" maxLength={8} />
                        </div>
                        <p className="auth-disclaimer">
                            注册即代表您同意使用条款。免费用户每账号可创建 1 个专属域名。
                            若连续 180 天无访客，该域名将被自动回收。
                        </p>
                        <button id="btn-register-submit" type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                            {loading ? '注册中...' : '🎉 立即注册'}
                        </button>
                    </form>
                )}

                {/* ── Magic Link Form ── */}
                {tab === 'magic' && (
                    magicSent
                        ? (
                            <div className="alert alert--success" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                                ✉️ 魔法登录邮件已发送！<br />
                                请打开邮件中的链接即可直接登录，无需密码。
                            </div>
                        )
                        : (
                            <form onSubmit={handleMagicLink} id="form-magic">
                                <div className="form-group">
                                    <label htmlFor="magic-email">邮箱</label>
                                    <input id="magic-email" type="email" value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="你的邮箱地址" required />
                                </div>
                                <p className="auth-disclaimer">
                                    系统将向此邮箱发送一次性登录链接，点击即可登录，安全且无需记忆密码。
                                </p>
                                <button id="btn-magic-submit" type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                                    {loading ? '发送中...' : '✨ 发送魔法链接'}
                                </button>
                            </form>
                        )
                )}

                <p className="auth-footer-link">
                    <Link to="/gallery">← 先浏览模板，看完再注册</Link>
                </p>
            </div>
        </div>
    );
}
