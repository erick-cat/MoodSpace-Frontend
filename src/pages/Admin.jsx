import { useState, useEffect } from 'react';
import { uploadTemplate, syncTemplates, pruneTemplates, refreshQuotas, refreshBlocklist, updateUserTier, getTiers, getSyncStatus, listTemplates } from '../api/client.js';
import { supabase } from '../lib/supabase.js';

export default function Admin() {
    const [adminKey, setAdminKey] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [files, setFiles] = useState([]);
    const [detectedTitle, setDetectedTitle] = useState('');
    const [existingTemplates, setExistingTemplates] = useState([]);

    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);
    const [loadingQuotas, setLoadingQuotas] = useState(false);
    const [loadingBlocklist, setLoadingBlocklist] = useState(false);
    const [loadingTier, setLoadingTier] = useState(false);
    const [loadingCheck, setLoadingCheck] = useState(false);
    const [loadingPrune, setLoadingPrune] = useState(false);
    const [userId, setUserId] = useState(null);
    const [currentTier, setCurrentTier] = useState(null);
    const [tiers, setTiers] = useState({});
    const [syncWarnings, setSyncWarnings] = useState({ quotas: false, blocklist: false });
    const [msg, setMsg] = useState({
        main: { error: null, success: null },
        upload: { error: null, success: null },
        tier: { error: null, success: null },
        kv: { error: null, success: null }
    });

    const clearMsgs = () => setMsg({
        main: { error: null, success: null },
        upload: { error: null, success: null },
        tier: { error: null, success: null },
        kv: { error: null, success: null }
    });

    const getErrorMessage = (err) => {
        const msgStr = err.message || String(err);
        if (msgStr.includes('templateName must contain')) return '模板英文名格式错误：仅限小写字母、数字或下划线';
        if (msgStr.includes('index.html is required')) return '核心文件缺失：必须包含 index.html';
        if (msgStr.includes('Invalid admin key') || msgStr.includes('401') || msgStr.includes('403')) return '同步失败：管理员密钥无效或权限不足';
        if (msgStr.includes('Failed to fetch')) return '网络错误：无法连接到 API 服务器，请检查网络或后端状态';
        return msgStr;
    };

    const fetchCurrentTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const res = await listTemplates();
            if (res.success) setExistingTemplates(res.templates);
        } catch (err) {
            console.error('Failed to fetch template list:', err);
        } finally {
            setLoadingTemplates(false);
        }
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
        fetchCurrentTemplates();
    }, []);

    const fetchTiers = async () => {
        try {
            setLoadingTier(true);
            const res = await getTiers();
            setTiers(res.tiers);
            localStorage.setItem('rs_tiers_config', JSON.stringify(res.tiers));
            setMsg(prev => ({ ...prev, tier: { success: '等级列表已从 VPS 实时获取并更新本地缓存。', error: null } }));
        } catch (err) {
            setMsg(prev => ({ ...prev, tier: { error: '获取等级失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingTier(false);
        }
    };

    const handleCheckSync = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        clearMsgs();
        setLoadingCheck(true);
        saveAdminKey(adminKey);

        try {
            const res = await getSyncStatus(adminKey);
            setSyncWarnings({
                quotas: !res.quotasSynced,
                blocklist: !res.blocklistSynced
            });
            if (res.isSynced) {
                setMsg(prev => ({ ...prev, main: { success: '✅ 经校验，VPS 内存数据与云端 KV 完全同步。' } }));
            } else {
                setMsg(prev => ({ ...prev, main: { error: '⚠️ 检测到云端 KV 有更新，请执行同步操作。' } }));
            }
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '同步校验失败: ' + getErrorMessage(err) } }));
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
        clearMsgs();

        if (!adminKey) return setMsg(prev => ({ ...prev, upload: { error: '请输入管理员密钥' } }));
        if (!templateName) return setMsg(prev => ({ ...prev, upload: { error: '请输入模板英文名称' } }));
        
        if (!/^[a-z0-9_]+$/.test(templateName)) {
            return setMsg(prev => ({ ...prev, upload: { error: '模板英文名不符合规范：仅限小写字母、数字和下划线' } }));
        }

        if (files.length === 0) return setMsg(prev => ({ ...prev, upload: { error: '请至少选择一个文件' } }));

        const isConflict = existingTemplates.some(t => t.name === templateName);
        if (isConflict) {
            const confirmed = window.confirm(`警告：模板 ID "${templateName}" 已存在！\n继续上传将覆盖原有的配置。您确定要以新版本覆盖吗？`);
            if (!confirmed) return;
        }

        const hasIndex = files.some(f => f.name === 'index.html');
        const configFile = files.find(f => f.name === 'config.json' || f.name === 'schema.json');
        
        if (!hasIndex) return setMsg(prev => ({ ...prev, upload: { error: '缺少核心文件：index.html' } }));
        if (!configFile) return setMsg(prev => ({ ...prev, upload: { error: '缺少配置文件：config.json' } }));

        let finalConfigFile = configFile;
        let renamePerformed = false;

        try {
            const configText = await configFile.text();
            let configJson = JSON.parse(configText);

            if (!configJson.name) return setMsg(prev => ({ ...prev, upload: { error: 'config.json 缺少 "name" 字段' } }));
            
            if (configJson.name !== templateName) {
                configJson.name = templateName;
                const blob = new Blob([JSON.stringify(configJson, null, 2)], { type: 'application/json' });
                finalConfigFile = new File([blob], configFile.name, { type: 'application/json' });
                renamePerformed = true;
            }

            if (!configJson.title) return setMsg(prev => ({ ...prev, upload: { error: 'config.json 缺少 "title" (中文名) 字段' } }));
            if (!configJson.fields || !Array.isArray(configJson.fields)) {
                return setMsg(prev => ({ ...prev, upload: { error: 'config.json 缺少 "fields" 数组' } }));
            }
        } catch (err) {
            return setMsg(prev => ({ ...prev, upload: { error: 'config.json 格式错误：请检查是否为有效的 JSON 文件' } }));
        }

        saveAdminKey(adminKey);

        const formData = new FormData();
        formData.append('templateName', templateName);
        formData.append('syncToGithub', 'true'); 
        
        files.forEach(file => {
            if (file.name === configFile.name) {
                formData.append(file.name, finalConfigFile);
            } else {
                formData.append(file.name, file);
            }
        });

        setLoadingUpload(true);
        try {
            const res = await uploadTemplate(formData, adminKey);
            let successMsg = `模板 ${res.title || res.templateName} (${res.version}) 上传成功！`;
            if (renamePerformed) {
                successMsg += ` (系统已自动同步 config.json 里的名称 ID)`;
            }
            
            setMsg(prev => ({ ...prev, upload: { success: successMsg, error: null } }));
            setFiles([]);
            setTemplateName('');
            setDetectedTitle('');
            
            const updatedList = await listTemplates();
            if (updatedList.success) setExistingTemplates(updatedList.templates);
        } catch (err) {
            setMsg(prev => ({ ...prev, upload: { error: getErrorMessage(err), success: null } }));
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleSync = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, upload: { error: '请输入管理员密钥' } }));
        clearMsgs();
        setLoadingSync(true);
        saveAdminKey(adminKey);
        try {
            const res = await syncTemplates(adminKey);
            let successMsg = `同步成功！共推送了 ${res.count} 个本地模板到云端。`;
            if (res.purgedCount > 0) {
                successMsg += ` 同时清理了 ${res.purgedCount} 个已在 Git 中删除的无效模板。`;
            }
            setMsg(prev => ({ ...prev, upload: { success: successMsg, error: null } }));
            fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, upload: { error: '同步操作失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingSync(false);
        }
    };

    const handlePrune = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        const confirmed = window.confirm('⚠️ 警告：存储深度清理将永久删除 R2 中所有“非活跃”版本的文件。\n\n这包括：\n1. 已上传但未被当前 KV 记录使用的旧版本文件\n2. 已被删除模板残留的碎片文件\n\n该操作无法撤销。是否继续？');
        if (!confirmed) return;

        clearMsgs();
        setLoadingPrune(true);
        saveAdminKey(adminKey);
        try {
            const res = await pruneTemplates(adminKey);
            setMsg(prev => ({ ...prev, main: { success: `存储清理完成！共删除了 ${res.objectsDeleted} 个残留对象，涉及 ${res.templatesPruned?.length || 0} 个目录。`, error: null } }));
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '清理失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingPrune(false);
        }
    };

    const handleUpdateTier = async (newTier) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, tier: { error: '请输入管理员密钥' } }));
        if (!userId) return setMsg(prev => ({ ...prev, tier: { error: '未登录：无法获取您的用户 ID' } }));
        
        clearMsgs();
        setLoadingTier(true);
        saveAdminKey(adminKey);

        try {
            await updateUserTier(userId, newTier, adminKey);
            setMsg(prev => ({ ...prev, tier: { success: `您的等级已成功更新为：${newTier}。请刷新页面或前往个人中心查看变更。`, error: null } }));
            setCurrentTier(newTier.toLowerCase());
        } catch (err) {
            setMsg(prev => ({ ...prev, tier: { error: '等级更新失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingTier(false);
        }
    };

    const handleRefreshKV = async (type) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, kv: { error: '请输入管理员密钥' } }));
        clearMsgs();
        
        if (type === 'quotas') setLoadingQuotas(true);
        else setLoadingBlocklist(true);

        saveAdminKey(adminKey);
        
        try {
            if (type === 'quotas') {
                await refreshQuotas(adminKey);
                setMsg(prev => ({ ...prev, kv: { success: '会员等级与配额已成功从暂存快照同步至 VPS 缓存。', error: null } }));
            } else {
                await refreshBlocklist(adminKey);
                setMsg(prev => ({ ...prev, kv: { success: '域名黑名单已成功从暂存快照同步至 VPS 缓存。', error: null } }));
            }
            setSyncWarnings(prev => ({ ...prev, [type]: false }));
        } catch (err) {
            setMsg(prev => ({ ...prev, kv: { error: `${type === 'quotas' ? '配额' : '黑名单'}刷新失败: ` + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingQuotas(false);
            setLoadingBlocklist(false);
        }
    };

    return (
        <div className="page container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 className="section-title">🛡️ 管理员后台</h1>
                <p className="section-sub">专属模板发版通道，直连 R2 边缘存储集群。</p>
            </div>

            <div className="admin-layout" style={{ 
                display: 'flex', 
                gap: '30px', 
                flexWrap: 'wrap',
                alignItems: 'flex-start'
            }}>
                {/* Main Content Area */}
                <div className="admin-main" style={{ flex: '1 1 500px' }}>
                    {msg.main.error && <div className="alert alert--error" style={{ marginBottom: '20px' }}>{msg.main.error}</div>}
                    {msg.main.success && <div className="alert alert--success" style={{ marginBottom: '20px' }}>{msg.main.success}</div>}

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
                            {existingTemplates.some(t => t.name === templateName) && (
                                <p style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '4px', fontWeight: 600 }}>
                                    ⚠️ 该 ID 已存在，上传将触发“覆盖更新”模式。
                                </p>
                            )}
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                * 此 ID 决定路径。若与 config.json 不符，上传时将自动同步源码配置。
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
                                🚀 自动同步已开启：同步至 GitHub 仓库
                            </div>
                        </div>

                        <div className="builder-submit" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
                            <button type="submit" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }} disabled={loadingUpload || loadingSync}>
                                {loadingUpload ? '正在发版...' : '🚀 增量上传'}
                            </button>
                            <button type="button" onClick={handleSync} className="btn" style={{ flex: 1, justifyContent: 'center', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }} disabled={loadingUpload || loadingSync}>
                                {loadingSync ? '...' : '🔄 全量同步'}
                            </button>
                        </div>
                        {msg.upload.error && <div className="alert alert--error" style={{ marginTop: '1.5rem', marginBottom: 0 }}>{msg.upload.error}</div>}
                        {msg.upload.success && <div className="alert alert--success" style={{ marginTop: '1.5rem', marginBottom: 0 }}>{msg.upload.success}</div>}
                    </form>

                    <div className="builder-card" style={{ marginTop: '30px', border: (syncWarnings.quotas || syncWarnings.blocklist) ? '1px solid #fbbf24' : '1px var(--primary-light) solid' }}>
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
                            如果您在 Cloudflare 直接修改了 KV，请同步刷新 VPS 里的本地缓存。
                        </p>

                        {(syncWarnings.quotas || syncWarnings.blocklist) && (
                            <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '10px', marginBottom: '15px', fontSize: '0.85rem', color: '#92400e' }}>
                                <strong>⚠️ 检测到配置漂移：</strong>
                                <ul style={{ margin: '5px 0 0 15px', padding: 0 }}>
                                    {syncWarnings.quotas && <li>云端等级配额已变更</li>}
                                    {syncWarnings.blocklist && <li>云端域名黑名单已变更</li>}
                                </ul>
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
                                {loadingQuotas ? '同步中...' : syncWarnings.quotas ? '⚡ 刷新配额' : '🔄 配额已同步'}
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
                                {loadingBlocklist ? '同步中...' : syncWarnings.blocklist ? '⚡ 刷新黑名单' : '🚫 名单已同步'}
                            </button>
                        </div>
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                            <button 
                                type="button" 
                                onClick={handlePrune} 
                                className="btn btn--sm" 
                                style={{ 
                                    width: '100%',
                                    background: '#fef2f2', 
                                    border: '1px solid #fecaca', 
                                    color: '#dc2626',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                }}
                                disabled={loadingPrune}
                            >
                                {loadingPrune ? '正在深度清理...' : '🧹 深度清理 R2 存储 (残留版本)'}
                            </button>
                            <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
                                * 彻底移除 R2 中不再被 KV 使用的旧版本和僵尸文件
                            </p>
                        </div>
                        {msg.kv.error && <div className="alert alert--error" style={{ marginTop: '1.5rem', marginBottom: 0 }}>{msg.kv.error}</div>}
                        {msg.kv.success && <div className="alert alert--success" style={{ marginTop: '1.5rem', marginBottom: 0 }}>{msg.kv.success}</div>}
                    </div>
                </div>

                {/* Sidebar area */}
                <div className="admin-sidebar" style={{ flex: '1 1 300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Template List Section */}
                    <div className="builder-card">
                        <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: 'var(--primary-dark)' }}>📋 已发布模板列表</h3>
                        {loadingTemplates ? (
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>正在获取...</p>
                        ) : existingTemplates.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>暂无模板</p>
                        ) : (
                            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>ID</th>
                                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>名称</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingTemplates.map(tmpl => (
                                            <tr key={tmpl.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#0f172a' }}>{tmpl.name}</td>
                                                <td style={{ padding: '6px 8px', color: '#64748b' }}>{tmpl.title}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '10px' }}>
                            库中共有 {existingTemplates.length} 个模板
                        </p>
                    </div>

                    {/* Tier Management Section */}
                    <div className="builder-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--primary-dark)' }}>👤 账号等级管理</h3>
                            <button 
                                type="button" 
                                onClick={fetchTiers} 
                                className="btn btn--sm" 
                                style={{ padding: '2px 8px', background: '#f8fafc', color: '#64748b', fontSize: '0.7rem' }}
                                disabled={loadingTier}
                            >
                                {loadingTier ? '...' : '🔄'}
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {Object.keys(tiers).length === 0 ? (
                                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>未加载配置</p>
                            ) : (
                                Object.keys(tiers).map(t => (
                                    <div key={t} style={{ 
                                        padding: '10px', 
                                        background: currentTier === t.toLowerCase() ? '#059669' : '#f8fafc', 
                                        color: currentTier === t.toLowerCase() ? '#fff' : 'inherit',
                                        border: currentTier === t.toLowerCase() ? 'none' : '1px solid #e2e8f0', 
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{tiers[t].label || t.toUpperCase()}</div>
                                            {currentTier === t.toLowerCase() && <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>当前等级</span>}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => handleUpdateTier(t)} 
                                            className="btn btn--sm" 
                                            style={{ 
                                                padding: '4px 8px',
                                                background: currentTier === t.toLowerCase() ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)', 
                                                color: currentTier === t.toLowerCase() ? '#fff' : 'var(--primary-dark)',
                                                border: 'none',
                                                fontSize: '0.7rem',
                                                fontWeight: 600
                                            }}
                                            disabled={loadingTier || currentTier === t.toLowerCase()}
                                        >
                                            {loadingTier ? '...' : currentTier === t.toLowerCase() ? '✓' : '切换'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        {msg.tier.error && <div className="alert alert--error" style={{ marginTop: '10px', fontSize: '0.75rem', padding: '8px' }}>{msg.tier.error}</div>}
                        {msg.tier.success && <div className="alert alert--success" style={{ marginTop: '10px', fontSize: '0.75rem', padding: '8px' }}>{msg.tier.success}</div>}
                    </div>

                    <div className="note" style={{ fontSize: '0.8rem' }}>
                        <strong>💡 操作说明：</strong>
                        <ul style={{ marginTop: '5px', paddingLeft: '15px', color: '#64748b' }}>
                            <li>右侧面板用于查看状态和辅助测试。</li>
                            <li>左侧面板用于执行模板发布和增量更新。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
