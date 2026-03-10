import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Gallery from './pages/Gallery.jsx';
import Builder from './pages/Builder.jsx';
import Admin from './pages/Admin.jsx';

function Navbar() {
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
                </div>
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <>
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/builder" element={<Builder />} />
                <Route path="/builder/:templateName" element={<Builder />} />
                <Route path="/admin/upload" element={<Admin />} />
            </Routes>
        </>
    );
}
