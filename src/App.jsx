import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
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
        <nav className="navbar">
            <div className="navbar__inner">
                <NavLink to="/" className="navbar__brand">💕 Romance</NavLink>
                <div className="navbar__links">
                    <NavLink to="/gallery" className={({ isActive }) => isActive ? 'active' : ''}>
                        大厅
                    </NavLink>
                    <NavLink to="/builder" className={({ isActive }) => isActive ? 'active' : ''}>
                        制作
                    </NavLink>
                    <NavLink to="/upgrade" className={({ isActive }) => isActive ? 'active' : ''}>
                        升级
                    </NavLink>
                    {user ? (
                        <>
                            <NavLink to="/myspace" className={({ isActive }) => isActive ? 'active' : ''} id="nav-myspace">
                                {profile?.display_name?.slice(0, 4) ?? '我的'}
                            </NavLink>
                            {profile?.role === 'admin' && (
                                <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''} id="nav-admin">
                                    管理
                                </NavLink>
                            )}
                            <button
                                id="nav-signout"
                                onClick={handleSignOut}
                                className="navbar__btn-link"
                            >
                                退出
                            </button>
                        </>
                    ) : (
                        <NavLink to="/auth" className={({ isActive }) => isActive ? 'active' : ''} id="nav-login">
                            登录
                        </NavLink>
                    )}
                </div>
            </div>
        </nav>
    );
}

function PageLoader() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="spinner" />
        </div>
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
                </Routes>
            </Suspense>
        </AuthProvider>
    );
}
