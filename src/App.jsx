import { Suspense, lazy } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Code-split all pages: only load the chunk for the current route
const Home = lazy(() => import('./pages/Home.jsx'));
const Gallery = lazy(() => import('./pages/Gallery.jsx'));
const Builder = lazy(() => import('./pages/Builder.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const MySpace = lazy(() => import('./pages/MySpace.jsx'));

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
                <NavLink to="/" className="navbar__brand">💕 RomanceSpace</NavLink>
                <div className="navbar__links">
                    <NavLink to="/gallery" className={({ isActive }) => isActive ? 'active' : ''}>
                        模板库
                    </NavLink>
                    <NavLink to="/builder" className={({ isActive }) => isActive ? 'active' : ''}>
                        创建页面
                    </NavLink>
                    {user ? (
                        <>
                            <NavLink to="/my-space" className={({ isActive }) => isActive ? 'active' : ''} id="nav-myspace">
                                {profile?.display_name ?? '我的空间'}
                            </NavLink>
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
                            登录 / 注册
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
                    <Route path="/admin/upload" element={<Admin />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/my-space" element={<MySpace />} />
                </Routes>
            </Suspense>
        </AuthProvider>
    );
}
