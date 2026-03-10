import { useState, useEffect } from 'react';
import { uploadTemplate } from '../api/client.js';

export default function Admin() {
    const [adminKey, setAdminKey] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [files, setFiles] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Initialize admin key from local storage
    useEffect(() => {
        const savedKey = localStorage.getItem('rs_admin_key');
        if (savedKey) setAdminKey(savedKey);
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!adminKey) return setError('请输入管理员密钥');
        if (!templateName) return setError('请输入模板英文名称');
        if (files.length === 0) return setError('请至少选择一个文件（必须包含 index.html）');

        // Save key for future convenience
        localStorage.setItem('rs_admin_key', adminKey);

        const formData = new FormData();
        formData.append('templateName', templateName);
        files.forEach(file => {
            // we use webkitRelativePath if available to keep folder structures, otherwise fallback to name
            const path = file.webkitRelativePath || file.name;
            // The API expects 'index.html' and 'schema.json' directly, but multer's any() 
            // uses fieldname or originalname. To be safe, we append them by their relative path.
            // Wait, the backend looks for f.fieldname === 'index.html'. 
            // So if it's the root index.html, we should name the field 'index.html'.
            // For other files, we can use their relative paths as field names so R2 stores them correctly.
            // If the user drops a folder, webkitRelativePath is "folderName/index.html".
            // Let's strip the root folder name if all files share it, or simplest: 
            // just ask user to select all files *inside* the template folder (not the folder itself).
            // Then file.name is just "index.html" "style.css" "assets/bg.jpg" (if they can select folders within).
            // Actually, HTML5 file input with webkitdirectory can do folders. 
            // Let's assume they pick files directly for now.
            formData.append(file.name, file);
        });

        setLoading(true);
        try {
            const res = await uploadTemplate(formData, adminKey);
            setSuccess(`模板 ${res.templateName} (${res.version}) 上传成功！`);
            setFiles([]);
            setTemplateName('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page container" style={{ maxWidth: 600 }}>
            <h1 className="section-title">🛡️ 管理员后台</h1>
            <p className="section-sub">专属模板发版通道，直连 R2 边缘存储集群。</p>

            {error && <div className="alert alert--error">{error}</div>}
            {success && <div className="alert alert--success">{success}</div>}

            <form onSubmit={handleSubmit} className="builder-card">
                <div className="form-group">
                    <label htmlFor="adminKey">🔑 超管密钥 (X-Admin-Key)</label>
                    <input
                        id="adminKey"
                        type="password"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        placeholder="请输入您的管理员密码"
                        required
                    />
                </div>

                <hr className="builder-divider" />

                <div className="form-group">
                    <label htmlFor="templateName">📁 模板英文名</label>
                    <input
                        id="templateName"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="e.g. love_card_v2 (小写字母/数字/下划线)"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>📄 模板源文件打包上传</label>
                    <div style={{
                        border: '2px dashed #e0d0d8',
                        padding: '2rem',
                        textAlign: 'center',
                        borderRadius: '8px',
                        background: '#fafafa',
                        cursor: 'pointer',
                        position: 'relative'
                    }}>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                opacity: 0, cursor: 'pointer'
                            }}
                        />
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📦</div>
                        <p style={{ color: '#7f8c8d', margin: 0, fontWeight: 500 }}>
                            {files.length > 0 ? `已选中 ${files.length} 个文件` : "点击或拖拽源文件到此处"}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#a0aab2', marginTop: '5px' }}>
                            必须包含 index.html 和 schema.json
                        </p>
                    </div>

                    {files.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666', background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
                            <strong>待上传清单：</strong>
                            <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                                {files.map((f, i) => (
                                    <li key={i}>{f.webkitRelativePath || f.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="builder-submit" style={{ marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                        {loading ? '正在全网发布...' : '🚀 一键发布模板到 R2'}
                    </button>
                </div>
            </form>
        </div>
    );
}
