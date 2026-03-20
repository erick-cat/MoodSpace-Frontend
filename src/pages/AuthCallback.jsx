import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const translateError = (msg) => {
    if (!msg) return '发生未知错误，请重试';
    if (msg.includes('expired') || msg.includes('invalid')) return '验证链接已失效或已被使用，请重新获取';
    if (msg.includes('rate limit')) return '操作太频繁啦，请稍等一会儿再试';
    if (msg.includes('Password should be at least')) return '密码太短啦，至少需要 8 个字符哦';
    if (msg.includes('same as the old one')) return '新密码不能和旧密码一样哦';
    return msg;
};

// Whether the URL already carries an error from Supabase (token expired/invalid)
function extractUrlError(hash, search) {
    // Supabase returns errors in the fragment (#error=...) or query string
    const h = new URLSearchParams(hash.replace('#', ''));
    const s = new URLSearchParams(search);
    return {
        error: h.get('error') || s.get('error'),
        errorDescription: h.get('error_description') || s.get('error_description'),
        type: h.get('type') || s.get('type'),
    };
}

export default function AuthCallback() {
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'recovery' | 'error'
    const [errorMsg, setErrorMsg] = useState('');

    // Password reset state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    // Re-send reset email state
    const [resendEmail, setResendEmail] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendDone, setResendDone] = useState(false);

    // Capture URL immediately on mount before Supabase can clear/mutate it
    const initialHash = useRef(window.location.hash);
    const initialSearch = useRef(window.location.search);

    useEffect(() => {
        let isMounted = true;

        // ── STEP 1: Check if Supabase already embedded an error in the URL ──
        // This happens when the OTP was already consumed (e.g. by email-app prefetch)
        // or has expired. In that case, skip any further network calls.
        const { error: urlError, errorDescription, type } = extractUrlError(
            initialHash.current,
            initialSearch.current
        );

        if (urlError) {
            const friendly = urlError === 'access_denied' || urlError === 'otp_expired'
                ? '重置链接已失效。可能原因：\n① 链接已点击过或被邮件APP预加载消耗\n② 链接有效期（1小时）已过期\n请重新发送重置邮件。'
                : translateError(errorDescription || urlError);

            setErrorMsg(friendly);
            setStatus('error');
            return;
        }

        // ── STEP 2: Determine flow type from URL before Supabase touches it ──
        const hashParams = new URLSearchParams(initialHash.current.replace('#', ''));
        const searchParams = new URLSearchParams(initialSearch.current);

        // type=recovery can come from hash (implicit flow) or search (PKCE flow via redirectTo)
        const isRecovery =
            hashParams.get('type') === 'recovery' ||
            searchParams.get('type') === 'recovery' ||
            type === 'recovery';

        // ── STEP 3: Listen for Supabase auth events BEFORE calling any API ──
        // This ensures we don't miss the PASSWORD_RECOVERY event fired during exchange
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (!isMounted) return;
            if (event === 'PASSWORD_RECOVERY') {
                setStatus('recovery');
            } else if (event === 'SIGNED_IN') {
                setStatus(prev => prev === 'recovery' ? 'recovery' : 'success');
            }
        });

        // ── STEP 4: Exchange the code/token ──
        async function handleCallback() {
            try {
                const code = searchParams.get('code');
                if (code) {
                    // PKCE flow (modern Supabase default)
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                } else {
                    // Implicit flow fallback — token is in the hash, getSession handles it
                    const { error } = await supabase.auth.getSession();
                    if (error) throw error;
                }

                if (!isMounted) return;

                // If onAuthStateChange already set 'recovery', don't override it
                setStatus(prev => {
                    if (prev === 'recovery') return 'recovery';
                    return isRecovery ? 'recovery' : 'success';
                });
            } catch (err) {
                console.error('[AuthCallback]', err);
                if (!isMounted) return;
                setErrorMsg(translateError(err.message) || '验证失败，链接可能已过期。');
                setStatus('error');
            }
        }

        handleCallback();

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    async function handlePasswordReset(e) {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致，请重新输入。');
            return;
        }
        if (newPassword.length < 8) {
            alert('密码至少需要 8 位。');
            return;
        }
        setResetLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            alert('密码更新失败：' + translateError(error.message));
        } else {
            setResetDone(true);
        }
        setResetLoading(false);
    }

    async function handleResend(e) {
        e.preventDefault();
        if (!resendEmail) return;
        setResendLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });
        if (error) {
            alert('发送失败：' + translateError(error.message));
        } else {
            setResendDone(true);
        }
        setResendLoading(false);
    }

    return (
        <div className="page container" style={{ maxWidth: 480 }}>
            <div className="auth-card" style={{ textAlign: 'center' }}>

                {/* ── Loading ── */}
                {status === 'loading' && (
                    <>
                        <div className="spinner" style={{ margin: '2rem auto' }} />
                        <p style={{ color: '#888' }}>正在验证中，请稍候…</p>
                    </>
                )}

                {/* ── Email Verification Success ── */}
                {status === 'success' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                        <h1 className="auth-title" style={{ fontSize: '1.4rem' }}>邮箱验证成功！</h1>
                        <p style={{ color: '#555', lineHeight: 1.7, marginTop: '0.8rem' }}>
                            您的账号已激活。
                        </p>
                        <div className="alert" style={{
                            background: '#fff8e1',
                            border: '1px solid #ffd54f',
                            borderRadius: '12px',
                            padding: '1rem 1.2rem',
                            marginTop: '1.5rem',
                            textAlign: 'left',
                            fontSize: '0.9rem',
                            lineHeight: 1.8,
                            color: '#555'
                        }}>
                            📱 <strong>如果您是在手机上打开此链接：</strong><br />
                            请返回电脑浏览器，使用您注册时的<strong>邮箱和密码登录</strong>即可开始使用。
                        </div>
                        <Link
                            to="/auth"
                            className="btn btn--primary auth-submit"
                            style={{ marginTop: '1.5rem', display: 'block', textDecoration: 'none', textAlign: 'center' }}
                        >
                            🔑 前往登录
                        </Link>
                    </>
                )}

                {/* ── Password Recovery Form ── */}
                {status === 'recovery' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
                        <h1 className="auth-title" style={{ fontSize: '1.4rem' }}>设置新密码</h1>

                        {resetDone ? (
                            <>
                                <div className="alert alert--success" style={{ marginTop: '1.5rem' }}>
                                    ✅ 密码已成功更新！
                                </div>
                                <Link
                                    to="/myspace"
                                    className="btn btn--primary auth-submit"
                                    style={{ marginTop: '1.5rem', display: 'block', textDecoration: 'none', textAlign: 'center' }}
                                >
                                    前往我的空间 →
                                </Link>
                            </>
                        ) : (
                            <form onSubmit={handlePasswordReset} id="form-reset-password" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                                <div className="form-group">
                                    <label htmlFor="new-password">新密码</label>
                                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex' }}>
                                        <input
                                            id="new-password"
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="至少 8 位"
                                            minLength={8}
                                            required
                                            style={{ width: '100%', paddingRight: '2.5rem' }}
                                        />
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
                                    <label htmlFor="confirm-password">确认新密码</label>
                                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex' }}>
                                        <input
                                            id="confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder="再次输入新密码"
                                            minLength={8}
                                            required
                                            style={{ width: '100%', paddingRight: '2.5rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            style={{
                                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888'
                                            }}
                                        >
                                            {showConfirmPassword
                                                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                            }
                                        </button>
                                    </div>
                                </div>
                                <button
                                    id="btn-reset-password"
                                    type="submit"
                                    className="btn btn--primary auth-submit"
                                    disabled={resetLoading}
                                >
                                    {resetLoading ? '更新中...' : '✅ 确认设置新密码'}
                                </button>
                            </form>
                        )}
                    </>
                )}

                {/* ── Error ── */}
                {status === 'error' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
                        <h1 className="auth-title" style={{ fontSize: '1.4rem' }}>重置链接失效</h1>
                        <div className="alert alert--error" style={{ marginTop: '1rem', textAlign: 'left', whiteSpace: 'pre-line' }}>
                            {errorMsg}
                        </div>

                        {/* ── Re-send Reset Email Form ── */}
                        {!resendDone ? (
                            <form onSubmit={handleResend} style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                                <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.75rem' }}>
                                    在下方输入您的邮箱，重新获取一封重置邮件：
                                </p>
                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                    <input
                                        id="resend-email"
                                        type="email"
                                        value={resendEmail}
                                        onChange={e => setResendEmail(e.target.value)}
                                        placeholder="输入您的注册邮箱"
                                        required
                                    />
                                </div>
                                <button
                                    id="btn-resend-reset"
                                    type="submit"
                                    className="btn btn--primary auth-submit"
                                    disabled={resendLoading}
                                >
                                    {resendLoading ? '发送中...' : '📧 重新发送重置邮件'}
                                </button>
                            </form>
                        ) : (
                            <div className="alert alert--success" style={{ marginTop: '1.5rem' }}>
                                ✉️ 新的重置邮件已发送！请在<strong>同一个浏览器</strong>中打开邮件中的链接。
                            </div>
                        )}

                        <Link
                            to="/auth"
                            className="btn btn--outline auth-submit"
                            style={{ marginTop: '1rem', display: 'block', textDecoration: 'none', textAlign: 'center' }}
                        >
                            ← 返回登录
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
