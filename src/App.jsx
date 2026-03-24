import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Code-split all pages: only load the chunk for the current route
const Home = lazy(() => import('./pages/Home.jsx'));
const Gallery = lazy(() => import('./pages/Gallery.jsx'));
const Builder = lazy(() => import('./pages/Builder.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Upgrade = lazy(() => import('./pages/Upgrade.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'));
const MySpace = lazy(() => import('./pages/MySpace.jsx'));
const Preview = lazy(() => import('./pages/Preview.jsx'));

/**
 * ProtectedRoute: Logic-based guard for authenticated and role-based routes.
 */
function ProtectedRoute({ children, adminOnly = false }) {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                toast.error('请先登录后再访问该页面 🔑');
                navigate('/auth', { replace: true });
            } else if (adminOnly && profile && profile.role !== 'admin') {
                toast.error('权限不足：该页面仅限管理员访问 🛡️');
                navigate('/', { replace: true });
            }
        }
    }, [user, profile, loading, navigate, adminOnly]);

    if (loading || !user || (adminOnly && (!profile || profile.role !== 'admin'))) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    return children;
}

function Navbar() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();

    async function handleSignOut() {
        await signOut();
        toast.success('已退出登录');
        navigate('/');
    }

    return (
        <nav className="global-navbar fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-12 py-4 md:py-6 bg-transparent backdrop-blur-3xl bg-gradient-to-b from-slate-950/50 to-transparent">
            <div>
                <NavLink 
                    to="/" 
                    onClick={(e) => {
                        if (window.location.pathname === '/') {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('moodspace-reset-home', { detail: { step: 0 } }));
                        }
                    }} 
                    className="text-xl md:text-2xl font-light tracking-widest text-indigo-50 dark:text-indigo-100 font-headline leading-relaxed" 
                    style={{ textDecoration: 'none' }}
                >
                    Mood Space
                </NavLink>
            </div>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-12 leading-relaxed">
                <NavLink to="/gallery" className={({ isActive }) => `text-indigo-200 font-medium text-sm tracking-wide ${isActive ? 'border-b border-indigo-400/30' : 'hover:border-b hover:border-indigo-400/30'}`} style={{ textDecoration: 'none' }}>
                    模板大厅
                </NavLink>
                <NavLink 
                    to="/" 
                    state={{ returnToStep: 0 }}
                    onClick={(e) => {
                        if (window.location.pathname === '/') {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('moodspace-reset-home', { detail: { step: 0 } }));
                        }
                    }} 
                    className="text-indigo-200 font-medium text-sm tracking-wide hover:border-b hover:border-indigo-400/30" 
                    style={{ textDecoration: 'none' }}
                >
                    制作
                </NavLink>
                {user ? (
                    <>
                        <NavLink to="/myspace" className={({ isActive }) => `text-indigo-200 font-medium text-sm tracking-wide ${isActive ? 'border-b border-indigo-400/30' : 'hover:border-b hover:border-indigo-400/30'}`} id="nav-myspace" style={{ textDecoration: 'none' }}>
                            我的空间
                        </NavLink>
                        {profile?.role === 'admin' && (
                            <NavLink to="/admin" className={({ isActive }) => `text-indigo-200 font-medium text-sm tracking-wide ${isActive ? 'border-b border-indigo-400/30' : 'hover:border-b hover:border-indigo-400/30'}`} id="nav-admin" style={{ textDecoration: 'none' }}>
                                管理站
                            </NavLink>
                        )}
                    </>
                ) : (
                    <NavLink to="/auth" id="nav-login" style={{ textDecoration: 'none' }}>
                        <button className="px-8 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-medium text-sm transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-primary/20">
                            登录
                        </button>
                    </NavLink>
                )}
            </div>

            {/* Mobile User Icon */}
            <div className="md:hidden flex items-center">
                {user ? (
                    <NavLink to="/myspace" className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-50">
                        <span className="material-symbols-outlined text-2xl">account_circle</span>
                    </NavLink>
                ) : (
                    <NavLink to="/auth" className="flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 text-primary-dim text-xs font-bold">
                        登录
                    </NavLink>
                )}
            </div>
        </nav>
    );
}

function MobileTabBar() {
    const { user } = useAuth();
    const location = useLocation();

    // Do not show Tab Bar on Builder or Preview pages to save space
    const isHidden = location.pathname.includes('/builder') || location.pathname.includes('/preview');
    if (isHidden) return null;

    return (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 flex justify-around items-center shadow-2xl shadow-black/40">
                <NavLink 
                    to="/" 
                    onClick={(e) => {
                        if (window.location.pathname === '/') {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('moodspace-reset-home', { detail: { step: 0 } }));
                        }
                    }}
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1.5 px-6 rounded-2xl transition-all ${isActive ? 'bg-primary/20 text-primary-dim' : 'text-slate-400'}`}
                >
                    <span className="material-symbols-outlined text-2xl">add_circle</span>
                    <span className="text-[10px] font-bold tracking-widest">制作</span>
                </NavLink>

                <NavLink 
                    to="/gallery" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1.5 px-6 rounded-2xl transition-all ${isActive ? 'bg-secondary/20 text-secondary-dim' : 'text-slate-400'}`}
                >
                    <span className="material-symbols-outlined text-2xl">explore</span>
                    <span className="text-[10px] font-bold tracking-widest">大厅</span>
                </NavLink>

                <NavLink 
                    to="/myspace" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1.5 px-6 rounded-2xl transition-all ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400'}`}
                >
                    <span className="material-symbols-outlined text-2xl">person</span>
                    <span className="text-[10px] font-bold tracking-widest">我的</span>
                </NavLink>
            </div>
        </div>
    );
}

function PageLoader() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="spinner" />
        </div>
    );
}

function GlobalFooter() {
    const [isSlim, setIsSlim] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleRouteAndScroll = () => {
            const path = location.pathname;
            if (path === '/') {
                // Home.jsx controls it via custom events, handled in the other useEffect
                return;
            } else if (path.includes('/builder')) {
                // Builder has fixed bottom elements, always keep it slim to prevent overlap
                setIsSlim(true);
                setIsHidden(false);
            } else {
                // Other pages (Gallery, etc.) use window scroll context
                setIsSlim(window.scrollY > 50);
                setIsHidden(false);
            }
        };

        handleRouteAndScroll();
        window.addEventListener('scroll', handleRouteAndScroll);
        
        return () => window.removeEventListener('scroll', handleRouteAndScroll);
    }, [location.pathname]);

    useEffect(() => {
        const handleScreenChange = (e) => {
            const screenIndex = e.detail;
            setIsHidden(screenIndex === 3);
            setIsSlim(screenIndex !== 0 && screenIndex !== 3);
        };
        window.addEventListener('moodspace-screen', handleScreenChange);
        return () => window.removeEventListener('moodspace-screen', handleScreenChange);
    }, []);

    return (
        <footer className={`global-footer hidden md:flex fixed bottom-0 left-0 w-full flex-col md:flex-row justify-between items-center z-50 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] border-t ${!isSlim || isHidden ? 'pointer-events-none' : 'pointer-events-auto'} ${isHidden ? 'translate-y-full opacity-0 bg-transparent border-transparent' : !isSlim ? 'py-8 md:py-12 px-8 md:px-12 bg-transparent border-transparent' : 'py-4 md:py-6 px-6 md:px-12 bg-surface border-outline-variant/20 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]'}`}>
            <div className={`font-light font-headline tracking-widest pointer-events-auto transition-all duration-700 ${!isSlim ? 'text-indigo-100/60 text-sm md:text-lg mb-4 md:mb-0' : 'text-indigo-100/40 text-xs md:text-sm mb-2 md:mb-0'}`}>
                每一种情绪，都有属于它的空间
            </div>
            <div className="flex gap-4 md:gap-8 pointer-events-auto mt-2 md:mt-0 transition-all duration-700 shadow-sm">
                <NavLink to="/gallery" className={`font-light tracking-widest uppercase hover:text-indigo-100 transition-colors ${!isSlim ? 'text-indigo-100/40 text-xs md:text-sm' : 'text-indigo-100/30 text-[10px] md:text-xs'}`}>进入大厅</NavLink>
                <NavLink to="/auth" className={`font-light tracking-widest uppercase hover:text-indigo-100 transition-colors ${!isSlim ? 'text-indigo-100/40 text-xs md:text-sm' : 'text-indigo-100/30 text-[10px] md:text-xs'}`}>管理空间</NavLink>
            </div>
        </footer>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 4000,
                    style: {
                        borderRadius: '12px',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                    },
                    success: {
                        iconTheme: { primary: '#d6336c', secondary: '#fff' },
                    },
                }}
            />
            <Navbar />
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/gallery" element={<Gallery />} />
                    <Route path="/builder" element={<Builder />} />
                    <Route path="/builder/:templateName" element={<Builder />} />
                    <Route path="/upgrade" element={<Upgrade />} />
                    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/myspace" element={<ProtectedRoute><MySpace /></ProtectedRoute>} />
                    <Route path="/my-space" element={<ProtectedRoute><MySpace /></ProtectedRoute>} />
                    <Route path="/preview/:templateName" element={<Preview />} />
                </Routes>
            </Suspense>
            <MobileTabBar />
            <GlobalFooter />
        </AuthProvider>
    );
}
