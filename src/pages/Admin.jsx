import { useState, useEffect } from 'react';
import { uploadTemplate, syncTemplates, refreshQuotas, refreshBlocklist, updateUserTier, getTiers, getSyncStatus } from '../api/client.js';
import { supabase } from '../lib/supabase.js';

export default function Admin() {
    const [adminKey, setAdminKey] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [files, setFiles] = useState([]);
    const [detectedTitle, setDetectedTitle] = useState('');

    const [loadingUpload, setLoadingUpload] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);
    const [loadingQuotas, setLoadingQuotas] = useState(false);
    const [loadingBlocklist, setLoadingBlocklist] = useState(false);
    const [loadingTier, setLoadingTier] = useState(false);
    const [loadingCheck, setLoadingCheck] = useState(false);
    const [userId, setUserId] = useState(null);
    const [currentTier, setCurrentTier] = useState(null);
    const [tiers, setTiers] = useState({});
    const [syncWarnings, setSyncWarnings] = useState({ quotas: false, blocklist: false });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const getErrorMessage = (err) => {
        const msg = err.message || String(err);
        if (msg.includes('templateName must contain')) return '模板英文名格式错误：仅限小写字母、数字或下划线';
        if (msg.includes('index.html is required')) return '核心文件缺失：必须包含 index.html';
        if (msg.includes('Invalid admin key') || msg.includes('401') || msg.includes('403')) return '同步失败：管理员密钥无效或权限不足';
        if (msg.includes('Failed to fetch')) return '网络错误：无法连接到 API 服务器，请检查网络或后端状态';
        return msg;
    };

    // Initialize admin key and user session
    useEffect(() => {
        const storedValue = localStorage.getItem('rs_admin_key');
        if (storedValue) {
            try {
                const { key, timestamp } = JSON.parse(storedValue);
                const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
                if (!isExpired) setAdminKey(key);
            } catch (e) { /* invalid format */ }
        }

        const fetchTiersConfig = async () => {
            // Priority: Local Storage (Fast) -> API (Fresh)
            const cached = localStorage.getItem('rs_tiers_config');
            if (cached) {
                try {
                    setTiers(JSON.parse(cached));
                } catch (e) { /* ignore */ }
            } else {
                try {
                    const res = await getTiers();
                    setTiers(res.tiers);
                    localStorage.setItem('rs_tiers_config', JSON.stringify(res.tiers));
                } catch (err) {
                    console.error('Initial tiers fetch failed:', err);
                }
            }
        };

        const getSessionAndProfile = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                setUserId(data.session.user.id);
                // Fetch current user profile to get tier
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tier')
                    .eq('id', data.session.user.id)
                    .single();
                if (profile) setCurrentTier(profile.tier?.toLowerCase() || 'free');
            }
        };

        getSessionAndProfile();
        fetchTiersConfig();
    }, []);

    const fetchTiers = async () => {
        try {
            setLoadingTier(true);
            const res = await getTiers();
            setTiers(res.tiers);
            localStorage.setItem('rs_tiers_config', JSON.stringify(res.tiers));
            setSuccess('等级列表已从 VPS 实时获取并更新本地缓存。');
        } catch (err) {
            setError('获取等级失败: ' + getErrorMessage(err));
        } finally {
            setLoadingTier(false);
        }
    };

    const handleCheckSync = async () => {
        if (!adminKey) return setError('请输入管理员密钥');
        setError(null);
        setLoadingCheck(true);
        saveAdminKey(adminKey);

        try {
            const res = await getSyncStatus(adminKey);
            setSyncWarnings({
                quotas: !res.quotasSynced,
                blocklist: !res.blocklistSynced
            });
            if (res.isSynced) {
                setSuccess('✅ 经校验，VPS 内存数据与云端 KV 完全同步。');
            } else {
                setError('⚠️ 检测到云端 KV 有更新，请执行同步操作。');
            }
        } catch (err) {
            setError('同步校验失败: ' + getErrorMessage(err));
        } finally {
            setLoadingCheck(false);
        }
    };

    const saveAdminKey = (key) => {
        const value = JSON.stringify({ key, timestamp: Date.now() });
        localStorage.setItem('rs_admin_key', value);
    };

    const handleFileChange = async (e) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(selectedFiles);
            setDetectedTitle('');

            // Try to pre-read config.json to show the Chinese title
            const config = selectedFiles.find(f => f.name === 'config.json' || f.name === 'schema.json');
            if (config) {
                try {
                    const text = await config.text();
                    const json = JSON.parse(text);
                    if (json.title) setDetectedTitle(json.title);
                } catch (err) {
                    console.warn('Failed to parse config.json preview');
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!adminKey) return setError('请输入管理员密钥');
        if (!templateName) return setError('请输入模板英文名称');
        
        // 1. Basic format check for template name
        if (!/^[a-z0-9_]+$/.test(templateName)) {
            return setError('模板英文名不符合规范：仅限小写字母、数字和下划线');
        }

        if (files.length === 0) return setError('请至少选择一个文件');

        // 2. Check for mandatory files
        const hasIndex = files.some(f => f.name === 'index.html');
        const configFile = files.find(f => f.name === 'config.json' || f.name === 'schema.json');
        
        if (!hasIndex) return setError('缺少核心文件：index.html');
        if (!configFile) return setError('缺少配置文件：config.json');

        // 3. Deep validation of config.json
        try {
            const configText = await configFile.text();
            const configJson = JSON.parse(configText);

            if (!configJson.name) return setError('config.json 缺少 "name" 字段');
            if (configJson.name !== templateName) {
                return setError(`名称不一致：config.json 中的 name (${configJson.name}) 与输入框中的名称 (${templateName}) 不匹配`);
            }
            if (!configJson.title) return setError('config.json 缺少 "title" (中文名) 字段');
            if (!configJson.fields || !Array.isArray(configJson.fields)) {
                return setError('config.json 缺少 "fields" 数组');
            }
        } catch (err) {
            return setError('config.json 格式错误：请检查是否为有效的 JSON 文件');
        }

        // Save key with timestamp
        saveAdminKey(adminKey);

        const formData = new FormData();
        formData.append('templateName', templateName);
        formData.append('syncToGithub', 'true'); // Mandatory sync
        files.forEach(file => {
            formData.append(file.name, file);
        });

        setLoadingUpload(true);
        try {
            const res = await uploadTemplate(formData, adminKey);
            setSuccess(`模板 ${res.title || res.templateName} (${res.version}) 上传成功！`);
            setFiles([]);
            setTemplateName('');
            setDetectedTitle('');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleSync = async () => {
        if (!adminKey) return setError('请输入管理员密钥');
        setError(null);
        setSuccess(null);
        setLoadingSync(true);
        saveAdminKey(adminKey);
        try {
            const res = await syncTemplates(adminKey);
            setSuccess(`同步成功！共推送了 ${res.count} 个本地模板到云端。`);
        } catch (err) {
            setError('同步操作失败: ' + getErrorMessage(err));
        } finally {
            setLoadingSync(false);
        }
    };

    const handleUpdateTier = async (newTier) => {
        if (!adminKey) return setError('请输入管理员密钥');
        if (!userId) return setError('未登录：无法获取您的用户 ID');
        
        setError(null);
        setSuccess(null);
        setLoadingTier(true);
        saveAdminKey(adminKey);

        try {
            await updateUserTier(userId, newTier, adminKey);
            setSuccess(`您的等级已成功更新为：${newTier}`);
            setCurrentTier(newTier.toLowerCase());
        } catch (err) {
            setError('等级更新失败: ' + getErrorMessage(err));
        } finally {
            setLoadingTier(false);
        }
    };

    const handleRefreshKV = async (type) => {
        if (!adminKey) return setError('请输入管理员密钥');
        setError(null);
        setSuccess(null);
        
        if (type === 'quotas') setLoadingQuotas(true);
        else setLoadingBlocklist(true);

        // Save key with timestamp
        saveAdminKey(adminKey);
        
        try {
            if (type === 'quotas') {
                await refreshQuotas(adminKey);
                setSuccess('会员等级与配额已成功从暂存快照同步至 VPS 缓存。');
            } else {
                await refreshBlocklist(adminKey);
                setSuccess('域名黑名单已成功从暂存快照同步至 VPS 缓存。');
            }
            // Clear warning after success
            setSyncWarnings(prev => ({ ...prev, [type]: false }));
        } catch (err) {
            setError(`${type === 'quotas' ? '配额' : '黑名单'}刷新失败: ` + getErrorMessage(err));
        } finally {
            setLoadingQuotas(false);
            setLoadingBlocklist(false);
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
                    <label htmlFor="adminKey">🔑 超级管理员密钥</label>
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
                    <label htmlFor="templateName">📁 模板英文名 ID (需与 config.json 一致)</label>
                    <input
                        id="templateName"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="例如：love_letter_v1"
                        required
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        * 此 ID 决定了网页的静态路径，且必须与文件夹内的 <code>config.json</code> 中的 <code>name</code> 字段严格一致。
                    </p>
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
                        {detectedTitle && (
                            <p style={{ color: '#d6336c', margin: '5px 0 0 0', fontWeight: 700, fontSize: '0.9rem' }}>
                                ✨ 已检测到显示名称：{detectedTitle}
                            </p>
                        )}
                        <p style={{ fontSize: '0.8rem', color: '#a0aab2', marginTop: '5px' }}>
                            必须包含 index.html 和 config.json
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

                <div className="form-group" style={{ marginBottom: '1rem', padding: '10px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bdf4c9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 600 }}>
                        🚀 自动同步已开启：所有文件将同步更新至 GitHub 模板仓库
                    </div>
                </div>

                <div className="builder-submit" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
                    <button type="submit" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }} disabled={loadingUpload || loadingSync}>
                        {loadingUpload ? '正在发版...' : '🚀 增量上传 (本地 -> 仓库)'}
                    </button>
                    <button type="button" onClick={handleSync} className="btn" style={{ flex: 1, justifyContent: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }} disabled={loadingUpload || loadingSync}>
                        {loadingSync ? '正在同步...' : '🔄 云端全量同步'}
                    </button>
                </div>
            </form>
            
            <div className="note" style={{ marginTop: '20px', fontSize: '0.85rem' }}>
                <strong>💡 核心操作说明：</strong>
                <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                    <li><strong>增量上传</strong>：将本地选中的模板文件上传并备份至 GitHub，适用于新增或修复特定模板。</li>
                    <li><strong>全量同步</strong>：以 GitHub 仓库为唯一“真理源”，强制刷新 R2 和 KV 数据，确保全平台数据对齐。</li>
                </ul>
            </div>

            <div className="builder-card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--primary-dark)' }}>👤 管理员账号等级管理</h3>
                    <button 
                        type="button" 
                        onClick={fetchTiers} 
                        className="btn btn--sm" 
                        style={{ padding: '4px 10px', background: '#f8fafc', color: '#64748b', fontSize: '0.75rem' }}
                        disabled={loadingTier}
                    >
                        {loadingTier ? '读取中...' : '📥 加载/刷新等级列表'}
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>
                    您可以手动更改您当前的会员等级，用于功能测试或权限模拟。
                </p>
                {Object.keys(tiers).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '10px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                        请先加载等级列表
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                    {Object.keys(tiers).map(t => (
                        <div key={t} style={{ 
                            padding: '12px', 
                            background: currentTier === t.toLowerCase() ? 'var(--primary-light)' : '#fff', 
                            border: currentTier === t.toLowerCase() ? '2px solid var(--primary-dark)' : '1px solid #e2e8f0', 
                            borderRadius: '10px',
                            boxShadow: currentTier === t.toLowerCase() ? '0 4px 12px rgba(214, 51, 108, 0.15)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            position: 'relative'
                        }}>
                            {currentTier === t.toLowerCase() && (
                                <span style={{ 
                                    position: 'absolute', 
                                    top: '-10px', 
                                    right: '10px', 
                                    background: 'var(--primary-dark)', 
                                    color: '#fff', 
                                    fontSize: '0.65rem', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px',
                                    fontWeight: 600
                                }}>当前</span>
                            )}
                            <div style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>
                                {tiers[t].label || t.toUpperCase()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                                📁 项目额度: <strong>{tiers[t].limit}</strong><br/>
                                ✍️ 每日编辑: <strong>{tiers[t].dailyLimit}</strong><br/>
                                🌐 最短域名: <strong>{tiers[t].minDomainLen} 字</strong>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => handleUpdateTier(t)} 
                                className="btn btn--sm" 
                                style={{ 
                                    width: '100%', 
                                    padding: '6px',
                                    marginTop: '5px',
                                    background: 'var(--primary-light)', 
                                    color: 'var(--primary-dark)',
                                    border: 'none',
                                    fontSize: '0.75rem'
                                }}
                                disabled={loadingTier}
                            >
                                {loadingTier ? '...' : '切换至该等级'}
                            </button>
                        </div>
                    ))}
                </div>
                )}
            </div>

            <div className="builder-card" style={{ marginTop: '20px', border: (syncWarnings.quotas || syncWarnings.blocklist) ? '1px solid #fbbf24' : '1px var(--primary-light) solid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--primary-dark)' }}>⚙️ 边缘同步与缓存刷新</h3>
                    <button 
                        type="button" 
                        onClick={handleCheckSync} 
                        className="btn btn--sm" 
                        style={{ padding: '4px 10px', background: loadingCheck ? '#fffbeb' : '#f8fafc', color: '#d97706', fontSize: '0.75rem', border: '1px solid #fde68a' }}
                        disabled={loadingCheck}
                    >
                        {loadingCheck ? '校验中...' : '🔍 检测云端更新'}
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '15px' }}>
                    如果您在 Cloudflare 控制台直接修改了 KV 值，请点击下方按钮强制更新服务器缓存。
                </p>

                {(syncWarnings.quotas || syncWarnings.blocklist) && (
                    <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '10px', marginBottom: '15px', fontSize: '0.85rem', color: '#92400e' }}>
                        <strong>⚠️ 检测到配置漂移：</strong>
                        <ul style={{ margin: '5px 0 0 15px', padding: 0 }}>
                            {syncWarnings.quotas && <li>云端等级配额 (Quotas) 已变更</li>}
                            {syncWarnings.blocklist && <li>云端域名黑名单 (Blocklist) 已变更</li>}
                        </ul>
                        请点击下方对应按钮执行同步。
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        type="button" 
                        onClick={() => handleRefreshKV('quotas')} 
                        className="btn btn--sm" 
                        style={{ 
                            flex: 1, 
                            background: syncWarnings.quotas ? '#fffbeb' : '#f8fafc', 
                            border: syncWarnings.quotas ? '1px solid #fde68a' : '1px solid #e2e8f0', 
                            color: syncWarnings.quotas ? '#b45309' : '#94a3b8',
                            fontWeight: syncWarnings.quotas ? 600 : 400
                        }}
                        disabled={loadingQuotas || !syncWarnings.quotas}
                    >
                        {loadingQuotas ? '同步中...' : syncWarnings.quotas ? '⚡ 立即修复配额同步' : '🔄 配额已同步'}
                    </button>
                    <button 
                        type="button" 
                        onClick={() => handleRefreshKV('blocklist')} 
                        className="btn btn--sm" 
                        style={{ 
                            flex: 1, 
                            background: syncWarnings.blocklist ? '#fffbeb' : '#f8fafc', 
                            border: syncWarnings.blocklist ? '1px solid #fde68a' : '1px solid #e2e8f0', 
                            color: syncWarnings.blocklist ? '#b45309' : '#94a3b8',
                            fontWeight: syncWarnings.blocklist ? 600 : 400
                        }}
                        disabled={loadingBlocklist || !syncWarnings.blocklist}
                    >
                        {loadingBlocklist ? '同步中...' : syncWarnings.blocklist ? '⚡ 立即修复名单同步' : '🚫 名单已同步'}
                    </button>
                </div>
            </div>
        </div>
    );
}
