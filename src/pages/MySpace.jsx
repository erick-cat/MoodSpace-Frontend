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
    const [viewMode, setViewMode] = useState('grid');
    const [status, setStatusState] = useState(() => {
        const cached = localStorage.getItem('rs_status');
        if (cached) {
            try { return JSON.parse(cached); } catch (e) {}
        }
        return { 
            count: 0, 
            maxDomains: 1, 
            tier: 'free',
            label: '🌟 体验用户',
            dailyUsedEdits: 0,
            maxDailyEdits: 5,
            inviteBonus: 0,
            bg: '#f0e6ee',
            color: 'var(--pink)'
        };
    });

    const setStatus = (newStatus) => {
        setStatusState(newStatus);
        localStorage.setItem('rs_status', JSON.stringify(newStatus));
    };
    // loadingStatus = false if we have cached data (so quota cards render immediately)
    const [loadingStatus, setLoadingStatus] = useState(() => !localStorage.getItem('rs_status'));
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
        localStorage.removeItem('rs_status');
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
        <div className="w-full h-full relative font-body text-on-surface">
            <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 30%, #1e1a41 0%, #0d0a27 100%)' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(224, 142, 254, 0.08) 0%, transparent 40%), radial-gradient(circle at 10% 80%, rgba(144, 148, 250, 0.1) 0%, transparent 50%)' }} />
            </div>

            <main className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen flex flex-col">
                <div className="flex flex-col lg:flex-row gap-8 flex-1">
                    
                    <aside className="lg:w-[350px] flex-shrink-0 space-y-6">
                        <div className="glass-card rounded-lg p-8 flex flex-col items-center text-center relative overflow-hidden bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                            
                            <div className="relative mb-6">
                                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-primary via-secondary to-tertiary">
                                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-surface bg-surface flex items-center justify-center text-4xl text-on-surface font-headline font-bold">
                                        {profile?.display_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            {isEditingNickname ? (
                                <div className="flex gap-2 items-center mb-2">
                                    <input 
                                        className="w-32 bg-surface border border-outline-variant/30 rounded p-1 text-on-surface text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        value={newNickname}
                                        onChange={e => setNewNickname(e.target.value)}
                                        placeholder="新昵称"
                                        autoFocus
                                    />
                                    <button className="text-primary hover:text-primary-dim cursor-pointer" onClick={handleUpdateNickname}>
                                        <span className="material-symbols-outlined text-base">check</span>
                                    </button>
                                    <button className="text-on-surface-variant hover:text-on-surface cursor-pointer" onClick={() => setIsEditingNickname(false)}>
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-2 group/nickname cursor-pointer" onClick={() => {
                                    setNewNickname(profile?.display_name || '');
                                    setIsEditingNickname(true);
                                }}>
                                    <h1 className="text-2xl font-headline font-semibold tracking-tight text-on-surface">{profile?.display_name || '探索者'}</h1>
                                    <span className="material-symbols-outlined text-sm text-on-surface-variant opacity-0 group-hover/nickname:opacity-100 transition-opacity" title="修改昵称">edit</span>
                                </div>
                            )}
                            
                            <div className="px-3 py-0.5 bg-primary/20 text-primary-dim rounded-full text-[10px] font-bold border border-primary/30 uppercase tracking-widest mb-4">
                                {status.label || profile?.tier?.toUpperCase() || 'FREE'}
                            </div>

                            <p className="text-on-surface-variant font-light text-xs italic">
                                {user.email}
                            </p>
                            
                            <button className="mt-6 text-xs text-error/80 hover:text-error border border-error/20 hover:bg-error/10 px-4 py-1.5 rounded-full transition-colors flex items-center gap-1" onClick={handleSignOut}>
                                <span className="material-symbols-outlined text-[14px]">logout</span>退出登录
                            </button>
                        </div>

                        <div className="glass-card rounded-lg p-6 bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10">
                            <h3 className="text-base font-headline font-bold mb-6 flex items-center gap-2 text-on-surface">
                                <span className="material-symbols-outlined text-primary text-lg">analytics</span>
                                额度统计
                            </h3>
                            <div className="space-y-6 flex flex-col">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="32" cy="32" fill="transparent" r="28" stroke="#1e1a41" strokeWidth="5"></circle>
                                            <circle cx="32" cy="32" fill="transparent" r="28" stroke="url(#primaryGradient)" strokeDasharray="175.93" strokeDashoffset={175.93 - (175.93 * Math.min(1, status.count / status.maxDomains))} strokeLinecap="round" strokeWidth="5"></circle>
                                            <defs>
                                                <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#e08efe"></stop>
                                                    <stop offset="100%" stopColor="#d180ef"></stop>
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <span className="absolute text-[13px] font-headline font-bold text-on-surface flex flex-col items-center leading-none">
                                            <span>{status.count}</span><span className="text-[9px] text-on-surface-variant font-medium">/{status.maxDomains}</span>
                                        </span>
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-sm text-on-surface font-medium leading-none mb-1.5">已创建空间</p>
                                        {status.inviteBonus > 0 && <p className="text-primary-dim text-[10px] font-medium leading-none">邀请奖励 +{status.inviteBonus}</p>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="32" cy="32" fill="transparent" r="28" stroke="#1e1a41" strokeWidth="5"></circle>
                                            <circle cx="32" cy="32" fill="transparent" r="28" stroke="#9094fa" strokeDasharray="175.93" strokeDashoffset={175.93 - (175.93 * Math.min(1, status.dailyUsedEdits / status.maxDailyEdits))} strokeLinecap="round" strokeWidth="5"></circle>
                                        </svg>
                                        <span className="absolute text-[13px] font-headline font-bold text-on-surface flex flex-col items-center leading-none">
                                            <span>{Math.round((status.dailyUsedEdits / status.maxDailyEdits) * 100)}%</span>
                                        </span>
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-sm text-on-surface font-medium leading-none mb-1.5">今日交互消耗</p>
                                        <p className="text-secondary text-[10px] font-medium leading-none">剩余 {Math.max(0, status.maxDailyEdits - status.dailyUsedEdits)} 次修改</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-outline-variant/10">
                                <div className="flex items-center justify-between text-xs mb-3">
                                    <span className="text-on-surface-variant">会员有效期</span>
                                    <span className="text-on-surface font-bold">
                                        {profile?.subscription_expires_at 
                                            ? (new Date(profile.subscription_expires_at) > new Date() 
                                                ? `剩余 ${Math.ceil((new Date(profile.subscription_expires_at) - new Date()) / (1000 * 60 * 60 * 24))} 天` 
                                                : '已到期')
                                            : '永久有效 (体验)'}
                                    </span>
                                </div>
                                <Link to="/upgrade" className="block w-full">
                                    <button className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary-dim text-sm font-bold rounded-xl transition-all border border-primary/20 cursor-pointer">
                                        {profile?.tier === 'free' || !profile?.tier ? '🚀 开启升级之旅' : '💎 立即续订特权'}
                                    </button>
                                </Link>
                            </div>
                        </div>

                        <div className="glass-card rounded-lg p-6 bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10">
                            <h3 className="text-base font-headline font-bold mb-4 text-on-surface">邀请奖励</h3>
                            {inviteCode ? (
                                <div className="space-y-4">
                                    <div className="bg-black/20 p-3 rounded-xl border border-outline-variant/10">
                                        <label className="text-xs text-on-surface-variant uppercase tracking-widest mb-2 block">专属邀请码</label>
                                        <div className="flex items-center justify-between">
                                            <span className="font-headline font-bold text-secondary-fixed tracking-widest text-lg">{inviteCode}</span>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(inviteUrl);
                                                    toast.success('邀请链接已复制');
                                                }}
                                                className="text-xs bg-secondary-container px-3 py-1.5 rounded text-on-secondary-container font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer">复制链接</button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/10 text-center flex flex-col justify-center">
                                            <p className="text-xs text-on-surface-variant mb-0.5 leading-none">已邀请</p>
                                            <p className="text-xl font-headline font-bold text-on-surface leading-none mt-1">{inviteCount} <span className="text-xs font-light">位</span></p>
                                        </div>
                                        <div className="p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/10 text-center flex flex-col justify-center">
                                            <p className="text-xs text-on-surface-variant mb-0.5 leading-none">额外额度</p>
                                            <p className="text-xl font-headline font-bold text-on-surface leading-none mt-1">+{inviteCount} <span className="text-xs font-light">空间</span></p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="w-full py-4 bg-primary/10 hover:bg-primary/20 text-primary-dim text-sm font-bold rounded-xl transition-all border border-primary/20"
                                    onClick={handleGenerateCode}
                                    disabled={generatingCode}
                                >
                                    {generatingCode ? '生成中...' : '✨ 生成我的邀请码'}
                                </button>
                            )}
                        </div>
                    </aside>

                    <div className="flex-1 flex flex-col">
                        <div className="flex-1 space-y-8">
                            <section>
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h2 className="text-2xl font-headline font-bold tracking-tight text-on-surface">我的空间</h2>
                                        <p className="text-sm text-on-surface-variant mt-1">管理并定制您的个人情感次元</p>
                                    </div>
                                    <div className="flex bg-surface-container-high/60 p-1 rounded-lg border border-outline-variant/10">
                                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded shadow-sm cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-surface-bright text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}><span className="material-symbols-outlined text-base">grid_view</span></button>
                                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded shadow-sm cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-surface-bright text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}><span className="material-symbols-outlined text-base">list</span></button>
                                    </div>
                                </div>

                                {loadingProjects && (
                                    <div className="flex justify-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary border-r-2 border-primary/30"></div>
                                    </div>
                                )}

                                {!loadingProjects && projects.length === 0 && (
                                    <div className="bg-surface-variant/30 border border-outline-variant/20 p-8 rounded-xl text-center mb-6">
                                        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">sentiment_dissatisfied</span>
                                        <p className="text-on-surface">暂未制作过网页。</p>
                                        <Link to="/gallery" className="text-primary font-bold mt-2 inline-block hover:underline hover:text-primary-dim">
                                            去挑选模板 →
                                        </Link>
                                    </div>
                                )}

                                <div className={`grid gap-6 relative ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1'}`}>
                                    {projects.map((p, index) => {
                                        const isLocked = projects.length > status.maxDomains && index !== 0;
                                        const url = `https://${p.subdomain}.${BASE_DOMAIN}`;
                                        
                                        const isSecondary = index % 2 !== 0; 
                                        const borderColorClass = isSecondary ? 'hover:border-secondary/40' : 'hover:border-primary/40';
                                        const gradientClass = isSecondary ? 'from-secondary/20 to-tertiary/20' : 'from-primary/20 to-secondary/20';
                                        const textClass = isSecondary ? 'text-secondary' : 'text-primary';
                                        const iconStr = isSecondary ? 'nightlight' : 'auto_awesome';
                                        const hoverBgTextClass = isSecondary ? 'hover:bg-secondary/20 hover:text-secondary' : 'hover:bg-primary/20 hover:text-primary';

                                        if (isLocked) {
                                            return (
                                                <div key={p.subdomain} className={`glass-card bg-surface-container-low/40 rounded-lg overflow-hidden relative group border border-outline-variant/10 ${viewMode === 'grid' ? 'h-[280px] flex-col' : 'h-32 flex-row'}`}>
                                                    <div className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-[2px] z-10 flex flex-col md:flex-row items-center justify-center text-center p-6 gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center border border-error/20 flex-shrink-0">
                                                            <span className="material-symbols-outlined text-error text-2xl">lock</span>
                                                        </div>
                                                        <div className="flex flex-col items-center md:items-start">
                                                            <p className="text-on-surface font-bold text-base mb-1">配额超限已锁定</p>
                                                            <p className="text-xs text-on-surface-variant mb-2">超出当前账户可持有的在线空间数量上限</p>
                                                        </div>
                                                        <Link to="/upgrade" className="md:ml-auto">
                                                            <button className="px-6 py-2 bg-error-container text-on-error-container text-xs rounded-full font-bold hover:brightness-110 transition-all uppercase tracking-widest cursor-pointer shadow-lg shadow-error/20">立即升级解锁</button>
                                                        </Link>
                                                    </div>
                                                    <div className="h-full flex opacity-20 grayscale pointer-events-none w-full">
                                                        <div className={`bg-surface-container-highest ${viewMode === 'grid' ? 'h-32 w-full' : 'h-full w-32'}`}></div>
                                                        <div className="p-6 flex-1 flex flex-col justify-center">
                                                            <h4 className="text-lg font-headline font-semibold mb-1 text-on-surface">已锁定的作品</h4>
                                                            <p className="text-sm text-on-surface-variant">{p.subdomain}.{BASE_DOMAIN}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={p.subdomain} className={`glass-card bg-surface-container-low/40 rounded-lg overflow-hidden group ${borderColorClass} transition-all flex border border-outline-variant/10 shadow-lg shadow-black/20 ${viewMode === 'grid' ? 'flex-col h-[280px]' : 'flex-row h-32 items-stretch'}`}>
                                                <div className={`relative bg-surface-container-highest overflow-hidden shrink-0 ${viewMode === 'grid' ? 'h-32 w-full' : 'w-40 h-full'}`}>
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} group-hover:scale-110 transition-transform duration-700`}></div>
                                                    <div className="absolute inset-0 flex items-center justify-center shadow-sm">
                                                        <span className={`material-symbols-outlined ${textClass} text-4xl bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10`}>{iconStr}</span>
                                                    </div>
                                                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20 uppercase font-bold tracking-tighter backdrop-blur-md">Live</div>
                                                </div>
                                                <div className={`p-5 flex flex-col flex-1 justify-between ${viewMode === 'list' && 'py-4'}`}>
                                                    <div className="overflow-hidden">
                                                        <h4 className="text-xl font-headline font-semibold mb-1 text-on-surface truncate">{p.template_type === 'custom' ? '自定义页面' : p.template_type}</h4>
                                                        <p className="text-sm text-on-surface-variant truncate block w-full tracking-wide">{p.subdomain}.{BASE_DOMAIN}</p>
                                                    </div>
                                                    <div className={`flex items-center justify-between border-t border-outline-variant/10 shrink-0 ${viewMode === 'grid' ? 'mt-4 pt-4' : 'mt-2 pt-2'}`}>
                                                        <div className="flex gap-2">
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className={`w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high/60 ${hoverBgTextClass} text-on-surface-variant transition-colors border border-outline-variant/5`} title="在新标签页中访问">
                                                                <span className="material-symbols-outlined text-lg">visibility</span>
                                                            </a>
                                                            <Link to={`/builder/${p.template_type}?edit=${p.subdomain}`} state={{ from: 'myspace' }} className={`w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high/60 ${hoverBgTextClass} text-on-surface-variant transition-colors border border-outline-variant/5`} title="重新编辑">
                                                                <span className="material-symbols-outlined text-lg">draw</span>
                                                            </Link>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(url);
                                                                    toast.success('已复制专属网址！');
                                                                }}
                                                                className={`w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-high/60 ${hoverBgTextClass} text-on-surface-variant transition-colors border border-outline-variant/5 cursor-pointer`} title="复制链接">
                                                                <span className="material-symbols-outlined text-lg">share</span>
                                                            </button>
                                                        </div>
                                                        <div className="text-xs text-on-surface-variant/70 font-medium">
                                                            {new Date(p.updated_at || p.created_at).toLocaleDateString('zh-CN')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!loadingProjects && (
                                        <Link to="/" className={`border border-dashed border-outline-variant/30 bg-surface-container-low/10 rounded-lg flex flex-col items-center justify-center text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-on-surface transition-all group shadow-sm ${viewMode === 'grid' ? 'h-[280px]' : 'h-32'}`}>
                                            <div className="w-14 h-14 rounded-full bg-surface-container-high/60 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all border border-outline-variant/10">
                                                <span className="material-symbols-outlined text-3xl group-hover:text-primary transition-colors">add</span>
                                            </div>
                                            <span className="font-headline font-medium text-base tracking-wide">前往首页选择模板</span>
                                        </Link>
                                    )}
                                </div>
                            </section>
                        </div>

                        {profile?.tier === 'free' && (
                            <div className="mt-12 mb-4 shrink-0">
                                <Link to="/upgrade" className="block w-full">
                                    <div className="bg-gradient-to-r from-primary-container/20 to-surface-container-low rounded-xl p-8 border border-primary/20 relative overflow-hidden group flex flex-col md:flex-row items-center justify-between gap-6 isolation-auto hover:border-primary/40 hover:shadow-[0_0_40px_rgba(224,142,254,0.15)] transition-all cursor-pointer">
                                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/20 blur-[60px] rounded-full pointer-events-none z-[-1] group-hover:bg-primary/30 transition-colors"></div>
                                        <div className="relative z-10">
                                            <h4 className="text-xl font-headline font-bold mb-2 tracking-tight text-on-surface group-hover:text-primary-dim transition-colors">开启无限之旅</h4>
                                            <p className="text-sm text-on-surface-variant leading-relaxed max-w-md">升级星耀版，解锁无限制空间及更多特权绑定，尽情释放你的浪漫创意。</p>
                                            <ul className="flex flex-wrap gap-4 md:gap-6 mt-4">
                                                <li className="flex items-center gap-1.5 text-[10px] text-on-surface uppercase tracking-wider font-bold">
                                                    <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                                    <span>更多空间额度</span>
                                                </li>
                                                <li className="flex items-center gap-1.5 text-[10px] text-on-surface uppercase tracking-wider font-bold">
                                                    <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                                    <span>专属特权标记</span>
                                                </li>
                                            </ul>
                                        </div>
                                        <div className="flex items-center gap-6 relative z-10 flex-shrink-0">
                                            <div className="px-8 py-3.5 bg-primary/20 text-primary-dim border border-primary/30 text-sm font-bold rounded-xl group-hover:bg-primary group-hover:text-on-primary group-hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/10 whitespace-nowrap">
                                                立即探索特权
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}
