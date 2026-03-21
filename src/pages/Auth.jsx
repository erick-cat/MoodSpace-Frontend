import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const translateError = (msg) => {
    if (!msg) return '发生未知错误，请重试';
    if (msg.includes('Invalid login credentials')) return '邮箱或密码不正确哦，请检查一下';
    if (msg.includes('User already registered')) return '这个邮箱已经注册过啦，请直接登录';
    if (msg.includes('Password should be at least')) return '密码太短啦，至少需要 8 个字符哦';
    if (msg.includes('rate limit')) return '操作太频繁啦，请稍等一会儿再试';
    if (msg.includes('Email not confirmed')) return '邮箱还没有验证哦，请去邮箱点一下验证链接';
    return msg; // Fallback
};

/**
 * Single page: handles Register, Login, and Forgot Password modes.
 */
export default function Auth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    // modes: 'login' | 'register' | 'forgot'
    const [tab, setTab] = useState('login'); 
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);

    // Initial load: Handle invite code persistence and mode switching
    useEffect(() => {
        // 1. Handle URL Mode (?mode=register)
        const mode = searchParams.get('mode');
        if (mode === 'register' || mode === 'login' || mode === 'forgot') {
            setTab(mode);
        }

        // 2. Handle Invite Code
        const urlRef = searchParams.get('ref');
        if (urlRef) {
            localStorage.setItem('rs_ref', JSON.stringify({ code: urlRef, time: Date.now() }));
            setInviteCode(urlRef.toUpperCase());
            // If we have a referral, default to registration unless mode is explicitly set
            if (!mode) setTab('register');
        } else {
            const saved = localStorage.getItem('rs_ref');
            if (saved) {
                try {
                    const { code, time } = JSON.parse(saved);
                    if (Date.now() - time < 86400000) {
                        setInviteCode(code.toUpperCase());
                    } else {
                        localStorage.removeItem('rs_ref');
                    }
                } catch (e) {
                    localStorage.removeItem('rs_ref');
                }
            }
        }
    }, [searchParams]);

    // If already logged in, redirect to MySpace
    useEffect(() => {
        if (user) navigate('/myspace', { replace: true });
    }, [user, navigate]);

    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(translateError(error.message));
        else {
            toast.success('登录成功！');
            navigate('/myspace');
        }
        setLoading(false);
    }

    async function handleRegister(e) {
        e.preventDefault();
        setLoading(true);

        let inviterId = null;
        if (inviteCode) {
            const { data: inviter } = await supabase
                .from('profiles')
                .select('id')
                .eq('invite_code', inviteCode.trim().toUpperCase())
                .maybeSingle();
            if (inviter) inviterId = inviter.id;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: nickname,
                    invited_by: inviterId
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            toast.error(translateError(error.message));
            setLoading(false);
            return;
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            toast.error('该邮箱已被注册，请直接登录或找回密码。');
            setTab('login');
            setLoading(false);
            return;
        }

        toast.success('注册成功！请查收验证邮件后登录。');
        setTab('login');
        setLoading(false);
    }

    async function handleForgotPassword(e) {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });

        if (error) {
            toast.error('发送失败：' + translateError(error.message));
        } else {
            toast.success('密码重置链接已发送！');
            setForgotSent(true);
        }
        setLoading(false);
    }

    return (
        <div className="page container" style={{ maxWidth: 460 }}>
            <div className="auth-card">
                <div className="auth-logo">💕</div>
                <h1 className="auth-title">浪漫空间</h1>
                <p className="auth-sub">
                    {tab === 'register' ? '加入我们，开启你的浪漫记录' : '登录后即可永久保存你的浪漫网页'}
                </p>

                {/* Tab switcher */}
                <div className="auth-tabs">
                    <button
                        id="tab-login"
                        className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                        onClick={() => { setTab('login'); setForgotSent(false); }}
                    >登录</button>
                    <button
                        id="tab-register"
                        className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                        onClick={() => { setTab('register'); setForgotSent(false); }}
                    >注册</button>
                    {tab === 'forgot' && (
                        <button className="auth-tab active">找回密码</button>
                    )}
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
                            <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex' }}>
                                <input id="login-password" type={showPassword ? "text" : "password"} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="请输入密码" required style={{ width: '100%', paddingRight: '2.5rem' }} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888'
                                    }}
                                >
                                    {showPassword 
                                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    }
                                </button>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', marginBottom: '0.75rem' }}>
                            <button
                                type="button"
                                className="auth-link-btn"
                                onClick={() => { setTab('forgot'); setForgotSent(false); }}
                            >
                                忘记密码？
                            </button>
                        </div>
                        <button id="btn-login-submit" type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                            {loading ? '登录中...' : '🔑 立即登录'}
                        </button>
                    </form>
                )}

                {/* ── Forgot Password Form ── */}
                {tab === 'forgot' && (
                    forgotSent
                        ? (
                            <div className="alert alert--success" style={{ marginTop: '0.5rem', textAlign: 'left', lineHeight: 1.8 }}>
                                ✉️ <strong>密码重置链接已发送！</strong><br />
                                <span style={{ fontSize: '0.9rem', color: '#555' }}>
                                    ⚠️ <strong>重要：</strong>请用<strong>手机系统浏览器</strong>（Safari / Chrome）打开邮件中的链接，
                                    不要在邮件APP的内嵌窗口中打开，否则可能导致链接失效。
                                </span>
                            </div>
                        )
                        : (
                            <form onSubmit={handleForgotPassword} id="form-forgot">
                                <div className="form-group">
                                    <label htmlFor="forgot-email">邮箱</label>
                                    <input id="forgot-email" type="email" value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="你注册时使用的邮箱" required />
                                </div>
                                <p className="auth-disclaimer">
                                    我们将向该邮箱发送一条加密链接，点击即可重置密码。
                                </p>
                                <button id="btn-forgot-submit" type="submit" className="btn btn--primary auth-submit" disabled={loading}>
                                    {loading ? '发送中...' : '📧 发送重置链接'}
                                </button>
                                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    <button
                                        type="button"
                                        className="auth-link-btn"
                                        onClick={() => setTab('login')}
                                    >
                                        返回登录
                                    </button>
                                </div>
                            </form>
                        )
                )}

                {/* ── Register Form ── */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} id="form-register">
                        <div className="form-group">
                            <label htmlFor="reg-nickname">昵称</label>
                            <input id="reg-nickname" type="text" value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                placeholder="怎么称呼你呢？" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-email">邮箱</label>
                            <input id="reg-email" type="email" value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="你的邮箱地址" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-password">密码</label>
                            <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex' }}>
                                <input id="reg-password" type={showPassword ? "text" : "password"} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="至少 8 位" minLength={8} required style={{ width: '100%', paddingRight: '2.5rem' }} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888'
                                    }}
                                >
                                    {showPassword 
                                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    }
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-invite">邀请码（选填）</label>
                            <input id="reg-invite" type="text" value={inviteCode}
                                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                placeholder="朋友的邀请码" maxLength={8} />
                        </div>
                        <div className="auth-disclaimer" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #ff477e', fontSize: '12px' }}>
                            注册即代表您同意使用条款。基础版每账号可免费制作 <b>1</b> 个专属网址。<br />
                            <span style={{ opacity: 0.8, display: 'block', marginTop: '4px' }}>
                                💡 若连续 180 天无人访问，该网址将被自动回收以节约服务器资源。
                            </span>
                        </div>
                        <button id="btn-register-submit" type="submit" className="btn btn--primary auth-submit" style={{ marginTop: '1rem' }} disabled={loading}>
                            {loading ? '注册中...' : '🎉 立即注册'}
                        </button>
                    </form>
                )}

                <p className="auth-footer-link">
                    <Link to="/gallery">← 先去挑选心仪模板，看完再注册</Link>
                </p>
            </div>
        </div>
    );
}
