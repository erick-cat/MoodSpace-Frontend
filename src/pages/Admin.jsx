import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
    uploadTemplate,
    syncTemplates,
    pruneTemplates,
    syncAllConfig,
    refreshGallery,
    updateUserTier,
    getTiers,
    listTemplates,
    deleteTemplate,
    updateTemplateStatus,
    listPricingAdmin,
    upsertPricingConfig,
    deletePricingConfig,
    syncTemplateMeta,
    deepSweepR2,
    purgeAllCDN,
    massRenderTemplate,
    checkSystemHealth
} from '../api/client.js';
import { supabase } from '../lib/supabase.js';

export default function Admin() {
    const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'storage' | 'operations'
    const [adminKey, setAdminKey] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [files, setFiles] = useState([]);
    const [detectedTitle, setDetectedTitle] = useState('');
    const [existingTemplates, setExistingTemplates] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);
    const [loadingSyncMeta, setLoadingSyncMeta] = useState(false);
    const [loadingSyncAll, setLoadingSyncAll] = useState(false);
    const [loadingGalleryRefresh, setLoadingGalleryRefresh] = useState(false);
    const [loadingTier, setLoadingTier] = useState(false);
    const [loadingPrune, setLoadingPrune] = useState(false);
    const [loadingDelete, setLoadingDelete] = useState(null); // stores template name being deleted
    const [loadingStatusChange, setLoadingStatusChange] = useState(null); // stores template name for status toggling
    
    // Troubleshooting Tool States
    const [loadingDeepSweep, setLoadingDeepSweep] = useState(false);
    const [loadingPurgeAll, setLoadingPurgeAll] = useState(false);
    const [loadingMassRender, setLoadingMassRender] = useState(null); // template name
    const [loadingHealth, setLoadingHealth] = useState(false);
    const [healthStats, setHealthStats] = useState(null);

    // Pricing Configs State
    const [pricingConfigs, setPricingConfigs] = useState([]);
    const [loadingPricing, setLoadingPricing] = useState(false);
    const [editingPricing, setEditingPricing] = useState(null); // null for new, or {id, ...}
    // Pricing form stores prices as Yuan strings (e.g. '9.90') for display.
    // Conversion to cents (integer) happens only on submit via yuanToCents().
    const [pricingForm, setPricingForm] = useState({
        tier: 'pro',
        pricing_type: 'first_month_discount', // 'first_month_discount' | 'fixed' | 'resident_discount'
        duration_months: '1',
        display_name: '',
        base_price_yuan: '',   // Crossed-out original price (¥)
        intro_price_yuan: '',  // First-time / introductory price (¥)
        renewal_price_yuan: '',// Renewal price (¥)
        discount_label: '',
        is_active: true,
        allow_renewal: true,   // NEW: if false, user can't renew at this price
        sort_order: '0'
    });

    const [userId, setUserId] = useState(null);
    const [currentTier, setCurrentTier] = useState(null);
    const [tiers, setTiers] = useState({});
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

    const fetchCurrentTemplates = async (key) => {
        const effectiveKey = key ?? adminKey;
        try {
            setLoadingTemplates(true);
            const res = await listTemplates(effectiveKey || null);
            if (res.success) setExistingTemplates(res.templates);
        } catch (err) {
            console.error('Failed to fetch template list:', err);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const fetchPricing = async (key) => {
        const effectiveKey = key ?? adminKey;
        if (!effectiveKey) return;
        try {
            setLoadingPricing(true);
            const res = await listPricingAdmin(effectiveKey);
            if (res.success) setPricingConfigs(res.data);
        } catch (err) {
            console.error('Failed to fetch pricing:', err);
        } finally {
            setLoadingPricing(false);
        }
    };

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
        if (storedValue) {
            try {
                const { key } = JSON.parse(storedValue);
                fetchPricing(key);
            } catch (e) { }
        }
    }, []);

    const fetchTiers = async () => {
        try {
            setLoadingTier(true);
            const res = await getTiers();
            setTiers(res.tiers);
            localStorage.setItem('rs_tiers_config', JSON.stringify(res.tiers));
            setMsg(prev => ({ ...prev, tier: { success: '等级列表已刷新。', error: null } }));
        } catch (err) {
            setMsg(prev => ({ ...prev, tier: { error: '获取等级失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingTier(false);
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
            if (renamePerformed) successMsg += ` (已自动同步 ID)`;

            setMsg(prev => ({ ...prev, upload: { success: successMsg, error: null } }));
            setFiles([]);
            setTemplateName('');
            setDetectedTitle('');

            fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, upload: { error: getErrorMessage(err), success: null } }));
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleSyncMeta = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚡ 确认执行配置同步？\n\n' +
            '这将从 GitHub 拉取所有模板的 config.json，对比 SHA 指纹后仅更新有变动的配置。\n不影响 HTML/CSS 代码，不升版本号，不影响正在运行的用户页面。\n\n' +
            '消耗估算：\n' +
            '• GitHub API 请求 × 模板数（不消耗 KV）\n' +
            '• KV Write + R2 Put × 有变化的模板数\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        clearMsgs();
        setLoadingSyncMeta(true);
        saveAdminKey(adminKey);
        try {
            const res = await syncTemplateMeta(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
            if (res.changedCount > 0) fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '增量同步失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingSyncMeta(false);
        }
    };

    const handleSync = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚠️ 确认拉取最新代码？\n\n' +
            '这将从 GitHub 扫描所有模板文件夹，对比 SHA 后重传有变动的资源并生成新版本号。\n旧版本文件将进入 24 小时 GC 队列等待清理。\n\n' +
            '消耗估算：\n' +
            '• R2 Put × 文件数（有变化的模板）\n' +
            '• KV Write × 有变化的模板数\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        clearMsgs();
        setLoadingSync(true);
        saveAdminKey(adminKey);
        try {
            const res = await syncTemplates(adminKey);
            let successMsg = `同步成功！共推送了 ${res.count} 个模板。`;
            if (res.purgedCount > 0) successMsg += ` 清理了 ${res.purgedCount} 个无效模板。`;
            setMsg(prev => ({ ...prev, main: { success: successMsg, error: null } }));
            fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '同步操作失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingSync(false);
        }
    };

    const handlePrune = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚠️ 确认进行存储深度清理？\n\n' +
            '这将永久删除 R2 中所有“非活跃”版本的文件。该操作无法撤销。\n\n' +
            '消耗估算：\n' +
            '• 1 次 KV Class A (扫描 GC 队列)\n' +
            '• N 次 R2 Class A/B (批量删除文件)\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        clearMsgs();
        setLoadingPrune(true);
        saveAdminKey(adminKey);
        try {
            const res = await pruneTemplates(adminKey);
            setMsg(prev => ({ ...prev, main: { success: `清理完成！共删除了 ${res.objectsDeleted} 个残留对象。`, error: null } }));
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '清理失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingPrune(false);
        }
    };

    const handleSyncAllConfig = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚠️ 确认同步运行配置？\n\n' +
            '这将从 KV 读取最新的等级配额（Quotas）和域名黑名单（Blocklist），并覆盖 VPS 运行内存，立即生效。\n\n' +
            '消耗估算：\n' +
            '• KV Read × 2（Quotas + Blocklist）\n' +
            '• R2 无消耗\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        clearMsgs();
        setLoadingSyncAll(true);
        saveAdminKey(adminKey);

        try {
            const res = await syncAllConfig(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
            // Add: Automaticaly refresh frontend tier info to match backend's newest memory
            await fetchTiers();
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '同步失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingSyncAll(false);
        }
    };

    const handleGalleryRefresh = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚠️ 确认刷新前台展示？\n\n' +
            '这将从 KV 列出所有模板，重构 templates.json 静态文件，并向 Cloudflare 推送全节点 CDN Purge 请求。\n\n' +
            '消耗估算：\n' +
            '• KV Read × 1（列出所有模板）\n' +
            '• R2 无消耗\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        setLoadingGalleryRefresh(true);
        try {
            const res = await refreshGallery(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
            fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '刷新失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingGalleryRefresh(false);
        }
    };

    // ── TROUBLESHOOTING HANDLERS ─────────────────────────────────────────────
    
    const handleHealthCheck = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        setLoadingHealth(true);
        try {
            const res = await checkSystemHealth(adminKey);
            if (res.success) {
                setHealthStats(res.stats);
                toast.success('连通性检测完成');
            }
        } catch (err) {
            toast.error('检测失败: ' + err.message);
        } finally {
            setLoadingHealth(false);
        }
    };

    const handleDeepSweep = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        const confirmed = window.confirm(
            '⚠️ 确认执行 [R2 深度扫描]？\n\n' +
            '这会遍历整个 R2 存储桶，直接物理删除所有：\n' +
            '1. 不在 KV 活跃版本列表中的旧文件夹。\n' +
            '2. 不在 24 小时保护队列中的遗留幽灵文件。\n\n' +
            '此操作适合在常规 [清理旧版本文件] 无法释放空间时使用，不可逆转。是否继续？'
        );
        if (!confirmed) return;

        setLoadingDeepSweep(true);
        try {
            const res = await deepSweepR2(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
            toast.success(res.message);
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '深度扫描失败: ' + err.message, success: null } }));
        } finally {
            setLoadingDeepSweep(false);
        }
    };

    const handlePurgeAll = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        const confirmed = window.confirm(
            '🚨 确认执行 [全站 CDN 强刷]？\n\n' +
            '这将请求 Cloudflare 立即丢弃本域名的所有边缘缓存（包括所有用户的页面、图片、静态资源）。\n' +
            '接下来全球用户的首次访问都将回源，可能会引起瞬间较高的 R2 流量。\n\n' +
            '一般用于紧急修复了全局 Bug，需要全国各地立刻生效的场景。是否继续？'
        );
        if (!confirmed) return;

        setLoadingPurgeAll(true);
        try {
            const res = await purgeAllCDN(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
            toast.success(res.message);
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '强刷失败: ' + err.message, success: null } }));
        } finally {
            setLoadingPurgeAll(false);
        }
    };

    const handleMassRender = async (tmplName) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        const confirmed = window.confirm(
            `⚠️ 注意：确认要为模板 [${tmplName}] 触发全量重新渲染吗？\n\n` +
            `系统将在后台静默查找所有正在使用 "${tmplName}" 的用户页面，并按照每秒约 10 个的速度逐一重新生成并覆盖他们的 R2 缓存。\n\n` +
            `适用场景：前端 Worker 结构调整 / 修复旧用户页面的核心 Bug。\n是否确认发起？`
        );
        if (!confirmed) return;

        setLoadingMassRender(tmplName);
        try {
            const res = await massRenderTemplate(tmplName, adminKey);
            toast.success(res.message);
        } catch (err) {
            toast.error('触发重新渲染失败: ' + err.message);
        } finally {
            setLoadingMassRender(null);
        }
    };

    const handleUpdateTier = async (newTier) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, tier: { error: '请输入管理员密钥' } }));
        if (!userId) return setMsg(prev => ({ ...prev, tier: { error: '未登录' } }));

        clearMsgs();
        setLoadingTier(true);
        saveAdminKey(adminKey);

        try {
            await updateUserTier(userId, newTier, adminKey);
            setMsg(prev => ({ ...prev, tier: { success: `等级已更新：${newTier}。`, error: null } }));
            setCurrentTier(newTier.toLowerCase());
        } catch (err) {
            setMsg(prev => ({ ...prev, tier: { error: '更新失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingTier(false);
        }
    };

    const handleToggleStatus = async (tmpl) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        const isActive = !tmpl.status || tmpl.status === 'active';
        const targetStatus = isActive ? 'offline' : 'active';
        const actionLabel = isActive ? '下架' : '重新上架';
        const confirmed = window.confirm(
            (isActive
                ? `⚠️ 确认下架模板 "${tmpl.title || tmpl.name}"？\n\n下架后，新用户无法选用此模板，但所有已发布的用户页面将继续正常运行。`
                : `✅ 确认将模板 "${tmpl.title || tmpl.name}" 重新上架？`) +
            `\n\n消耗估算：\n• 1 次 KV Class A (修改状态 Key)`
        );
        if (!confirmed) return;
        setLoadingStatusChange(tmpl.name);
        try {
            await updateTemplateStatus(tmpl.name, targetStatus, adminKey);
            setMsg(prev => ({ ...prev, main: { success: `模板 "${tmpl.name}" 已成功${actionLabel}。`, error: null } }));
            fetchCurrentTemplates();
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: `${actionLabel}失败: ` + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingStatusChange(null);
        }
    };

    const handleDeleteTemplate = async (name) => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            `❗ 危险操作：确定要删除模板 "${name}" 吗？\n\n` +
            `1. 所有使用该模板的用户页面将无法正常显示。\n` +
            `2. R2 中的相关文件将被彻底删除。\n\n` +
            `消耗估算：\n` +
            `• 1 次 KV Class A (删除路由)\n` +
            `• 1 次 R2 Class A (列出文件)\n` +
            `• N 次 R2 Class B (删除文件)\n\n` +
            `此操作不可逆，请确认！`
        );
        if (!confirmed) return;

        setLoadingDelete(name);
        try {
            const res = await deleteTemplate(name, adminKey);
            setMsg(prev => ({ ...prev, main: { success: `模板 "${name}" 已彻底删除。`, error: null } }));
            fetchCurrentTemplates();
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            if (errorMsg.includes('Template in use')) {
                const force = window.confirm(`${errorMsg}\n\n点击“确定”将强制删除（危险），点击“取消”中止操作。`);
                if (force) {
                    try {
                        // Retry with force query param — use API_BASE consistently
                        const BASE = import.meta.env.VITE_API_BASE_URL || '';
                        await fetch(`${BASE}/api/template/${name}?force=true`, {
                            method: 'DELETE',
                            headers: { 'X-Admin-Key': adminKey }
                        });
                        setMsg(prev => ({ ...prev, main: { success: `模板 "${name}" 已强制删除。`, error: null } }));
                        fetchCurrentTemplates();
                    } catch (e) {
                        setMsg(prev => ({ ...prev, main: { error: '强制删除失败: ' + e.message, success: null } }));
                    }
                }
            } else {
                setMsg(prev => ({ ...prev, main: { error: '删除失败: ' + errorMsg, success: null } }));
            }
        } finally {
            setLoadingDelete(null);
        }
    };

    // ── Pricing Helpers ──────────────────────────────────────────────────────
    // Convert Yuan string ('9.90') → cents integer (990) without float error.
    // Uses Math.round to guard against floating-point rounding artifacts.
    const yuanToCents = (yuanStr) => {
        if (!yuanStr && yuanStr !== 0) return null;
        const s = String(yuanStr).trim();
        if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
        return Math.round(parseFloat(s) * 100);
    };

    // Convert cents integer (990) → Yuan string ('9.90')
    const centsToYuan = (cents) => {
        if (cents == null) return '';
        return (Math.round(Number(cents)) / 100).toFixed(2);
    };

    const BLANK_PRICING_FORM = {
        tier: 'pro',
        pricing_type: 'first_month_discount',
        duration_months: '1',
        display_name: '',
        base_price_yuan: '',
        intro_price_yuan: '',
        renewal_price_yuan: '',
        discount_label: '',
        is_active: true,
        allow_renewal: true,
        sort_order: '0'
    };

    const handlePricingSubmit = async (e) => {
        e.preventDefault();
        if (!adminKey) return toast.error('请输入管理员密钥');

        const { pricing_type, tier, duration_months, display_name, base_price_yuan, intro_price_yuan, renewal_price_yuan, discount_label, is_active, allow_renewal, sort_order } = pricingForm;

        // --- Front-end validation ---
        const basePriceCents = yuanToCents(base_price_yuan);
        if (!basePriceCents || basePriceCents <= 0) return toast.error('划线原价格式有误（仅允许两位小数，如 99.00）');

        let firstMonthPriceCents = null;
        let renewalPriceCents = null;

        if (pricing_type === 'first_month_discount') {
            firstMonthPriceCents = yuanToCents(intro_price_yuan);
            renewalPriceCents = yuanToCents(renewal_price_yuan);
            if (!firstMonthPriceCents || firstMonthPriceCents <= 0) return toast.error('首月价格格式有误');
            if (!renewalPriceCents || renewalPriceCents <= 0) return toast.error('续费价格格式有误');
            if (firstMonthPriceCents > basePriceCents) return toast.error('首月价不能高于划线原价');
        } else if (pricing_type === 'fixed') {
            // Fixed price: intro_price IS the real price. renewal = base = intro.
            firstMonthPriceCents = yuanToCents(intro_price_yuan);
            if (!firstMonthPriceCents || firstMonthPriceCents <= 0) return toast.error('固定价格格式有误');
            renewalPriceCents = firstMonthPriceCents; // renewal same as purchase price
        } else if (pricing_type === 'resident_discount') {
            // Resident discount (annual/quarterly): single price, no renewal distinction.
            firstMonthPriceCents = yuanToCents(intro_price_yuan);
            if (!firstMonthPriceCents || firstMonthPriceCents <= 0) return toast.error('折扣价格格式有误');
            renewalPriceCents = yuanToCents(renewal_price_yuan) || null;
        }

        setLoadingPricing(true);
        try {
            const payload = {
                tier,
                duration_months: parseInt(duration_months) || 1,
                display_name: display_name.trim() || null,
                base_price: basePriceCents,
                first_month_price: firstMonthPriceCents,
                renewal_price: renewalPriceCents,
                discount_label: discount_label.trim() || null,
                is_active,
                allow_renewal,
                sort_order: parseInt(sort_order) || 0
            };
            if (editingPricing) payload.id = editingPricing.id;
            await upsertPricingConfig(payload, adminKey);
            toast.success(editingPricing ? '套餐已更新' : '套餐已创建');
            setEditingPricing(null);
            setPricingForm({ ...BLANK_PRICING_FORM });
            fetchPricing(adminKey);
        } catch (err) {
            toast.error('操作失败: ' + err.message);
        } finally {
            setLoadingPricing(false);
        }
    };

    const handleDeletePricing = async (id) => {
        if (!window.confirm('确定要删除这个套餐吗？这将导致前台无法购买该项。')) return;
        try {
            await deletePricingConfig(id, adminKey);
            toast.success('已删除');
            fetchPricing(adminKey);
        } catch (err) {
            toast.error('删除失败: ' + err.message);
        }
    };

    // When editing an existing config, map DB cents back to Yuan strings for form display
    const startEditPricing = (c) => {
        let pricing_type = 'fixed';
        if (c.first_month_price && c.renewal_price && c.first_month_price !== c.renewal_price) {
            pricing_type = 'first_month_discount';
        } else if (c.duration_months > 1) {
            pricing_type = 'resident_discount';
        }
        setEditingPricing(c);
        setPricingForm({
            tier: c.tier,
            pricing_type,
            duration_months: String(c.duration_months),
            display_name: c.display_name || '',
            base_price_yuan: centsToYuan(c.base_price),
            intro_price_yuan: centsToYuan(c.first_month_price ?? c.base_price),
            renewal_price_yuan: centsToYuan(c.renewal_price),
            discount_label: c.discount_label || '',
            is_active: c.is_active !== false,
            allow_renewal: c.allow_renewal !== false,
            sort_order: String(c.sort_order ?? 0)
        });
    };

    // Plain-language policy preview
    const getPricingPreview = () => {
        const { pricing_type, duration_months, intro_price_yuan, renewal_price_yuan, base_price_yuan } = pricingForm;
        const dur = parseInt(duration_months) || 1;
        const durLabel = dur === 1 ? '月' : `${dur}个月`;
        if (pricing_type === 'first_month_discount') {
            if (intro_price_yuan && renewal_price_yuan)
                return `用户首月仅需 ¥${intro_price_yuan}，之后每月续费 ¥${renewal_price_yuan}（划线原价 ¥${base_price_yuan || '--'}/月）`;
        } else if (pricing_type === 'fixed') {
            if (intro_price_yuan)
                return `用户购买 ${durLabel} 固定收取 ¥${intro_price_yuan}，无首月/续费区分`;
        } else if (pricing_type === 'resident_discount') {
            if (intro_price_yuan)
                return `${durLabel}套餐一次性优惠价 ¥${intro_price_yuan}（划线 ¥${base_price_yuan || '--'}），续费${renewal_price_yuan ? ` ¥${renewal_price_yuan}` : '同价'}`;
        }
        return '请填写价格以预览计费规则';
    };

    return (
        <div className="page container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 className="section-title">🛡️ 管理控制台</h1>
                <p className="section-sub">{import.meta.env.VITE_APP_NAME ?? 'Emotional Space'} 核心引擎调度与资源管理</p>
            </div>

            <div className="builder-card" style={{ padding: '15px 25px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px', background: '#fff', border: '1px solid #eee' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', marginBottom: '5px', display: 'block' }}>🔑 超级管理员密钥 (身份标识)</label>
                    <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="请输入授权密钥以执行敏感操作" style={{ margin: 0, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }} title="用于排查“同步卡顿”、“列表加载不出来”等与 Cloudflare 网络相关的问题">测速排查网络问题 👉</span>
                        <button onClick={handleHealthCheck} disabled={loadingHealth} className="btn" style={{ padding: '8px 12px', fontSize: '0.85rem', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}>
                            {loadingHealth ? '检测中...' : '🩺 系统健康诊断'}
                        </button>
                    </div>
                    {healthStats && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ color: healthStats.github.status === 'up' ? '#059669' : '#dc2626' }}>GH: {healthStats.github.ms}ms</span>
                            <span style={{ color: healthStats.kv.status === 'up' ? '#059669' : '#dc2626' }}>KV: {healthStats.kv.ms}ms</span>
                            <span style={{ color: healthStats.r2.status === 'up' ? '#059669' : '#dc2626' }}>R2: {healthStats.r2.ms}ms</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Alerts */}
            <div style={{ marginBottom: '20px' }}>
                {msg.main.error && <div className="alert alert--error" style={{ marginBottom: '10px' }}>{msg.main.error}</div>}
                {msg.main.success && <div className="alert alert--success" style={{ marginBottom: '10px' }}>{msg.main.success}</div>}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '30px' }}>
                {[{ key: 'templates', label: '🎨 模板中心' }, { key: 'storage', label: '⚙️ 存储管理' }, { key: 'operations', label: '📋 日常运营' }].map(tab => (
                    <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'operations') fetchPricing(adminKey); }}
                        style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--pink)' : 'none', color: activeTab === tab.key ? 'var(--pink-dark)' : '#64748b', fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer', fontSize: '1rem' }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="admin-content">
                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB 1: 模板中心                                            */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'templates' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '30px' }}>
                        {/* Left: Upload Form */}
                        <div className="builder-card" style={{ height: 'fit-content' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#333' }}>🚀 发布新模板</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>模板英文名 ID</label>
                                    <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="例如：anniversary_modern" required />
                                </div>
                                <div className="form-group">
                                    <label>本地代码打包</label>
                                    <div style={{ border: '2px dashed #eee', padding: '20px', textAlign: 'center', borderRadius: '10px', background: '#fafafa', position: 'relative' }}>
                                        <input type="file" multiple onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                        <p style={{ margin: 0, color: '#666' }}>{files.length > 0 ? `已选中 ${files.length} 个文件` : '点击上传源文件'}</p>
                                        {detectedTitle && <p style={{ margin: '5px 0', color: 'var(--pink)', fontWeight: 700 }}>{detectedTitle}</p>}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '10px' }} disabled={loadingUpload}>
                                    {loadingUpload ? '发版中...' : '确认发布 / 覆盖更新'}
                                </button>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
                                    💡 提示：请选择包含 index.html 和 config.json 的<b>文件夹</b>或<b>多个文件</b>进行上传。
                                </p>
                                {msg.upload.error && <div className="alert alert--error" style={{ marginTop: '15px' }}>{msg.upload.error}</div>}
                                {msg.upload.success && <div className="alert alert--success" style={{ marginTop: '15px' }}>{msg.upload.success}</div>}
                            </form>
                        </div>

                        {/* Right: Template List */}
                        <div className="builder-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
                                <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#333' }}>📋 模板库 ({existingTemplates.length})</h3>
                                <input type="text" placeholder="搜索 ID 或名称..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ margin: 0, padding: '5px 10px', width: '160px', fontSize: '0.85rem' }} />
                            </div>
                            {existingTemplates.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#666' }}>暂无模板</p>
                            ) : (
                                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ width: '30%', padding: '12px 8px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem' }}>ID</th>
                                                <th style={{ width: '30%', padding: '12px 8px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem' }}>名称</th>
                                                <th style={{ width: '15%', padding: '12px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>状态</th>
                                                <th style={{ width: '25%', padding: '12px 8px', textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {existingTemplates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase()))).map(tmpl => {
                                                const s = tmpl.status || 'active';
                                                const isActive = s === 'active';
                                                const statusMap = { active: { bg: '#ecfdf5', color: '#059669', border: '#10b981', label: '上架' }, offline: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', label: '下架' }, pending: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: '待审' }, rejected: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', label: '驳回' }, archived: { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', label: '归档' } };
                                                const st = statusMap[s] || statusMap.active;
                                                return (
                                                    <tr key={tmpl.name} style={{ borderBottom: '1px solid #f1f5f9', opacity: isActive ? 1 : 0.6 }}>
                                                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</td>
                                                        <td style={{ padding: '12px 8px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.title}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{st.label}</span>
                                                        </td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                                <button onClick={() => handleMassRender(tmpl.name)} className="btn btn--sm" disabled={loadingMassRender === tmpl.name} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '4px 10px' }} title="全量发版：重新生成所有使用该模板的用户页面">
                                                                    {loadingMassRender === tmpl.name ? '执行中...' : '全量重现'}
                                                                </button>
                                                                <button onClick={() => handleToggleStatus(tmpl)} className="btn btn--sm" disabled={loadingStatusChange === tmpl.name} style={{ background: isActive ? '#fff7ed' : '#ecfdf5', color: isActive ? '#ea580c' : '#059669', border: `1px solid ${isActive ? '#fed7aa' : '#6ee7b7'}`, padding: '4px 10px' }}>
                                                                    {loadingStatusChange === tmpl.name ? '...' : (isActive ? '下架' : '上架')}
                                                                </button>
                                                                <button onClick={() => handleDeleteTemplate(tmpl.name)} className="btn btn--sm" disabled={loadingDelete === tmpl.name} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '4px 10px' }}>
                                                                    {loadingDelete === tmpl.name ? '...' : '删除'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    /* ═══════════════════════════════════════════════════════════ */
                    /* TAB 2: 存储管理（有 KV/R2 消耗 + 危险操作区）              */
                    /* ═══════════════════════════════════════════════════════════ */
                ) : activeTab === 'storage' ? (() => {
                    const badgeKV = (label) => <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>{label}</span>;
                    const badgeR2 = (label) => <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>{label}</span>;
                    const badgeNone = (label) => <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{label}</span>;
                    const badgeRed = (label) => <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', whiteSpace: 'nowrap' }}>{label}</span>;
                    const sectionLabel = (text) => <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#64748b', fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{text}</p>;
                    const cardBase = (borderColor, children) => (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${borderColor}`, borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {children}
                        </div>
                    );
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 16px', fontSize: '0.82rem', color: '#64748b' }}>
                                ☁️ 以下操作均会消耗 Cloudflare <strong>KV</strong> 或 <strong>R2</strong> 存储额度，请按实际需要执行
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Card 1: 执行配置同步 */}
                                {cardBase('#3b82f6', <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>⚡ 仅更新配置</div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeKV('KV Write × 变动数')}{badgeR2('R2 Put × 变动数')}</div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                        {sectionLabel('适用场景')}
                                        <p style={{ margin: '0 0 10px' }}>只修改了模板的 config.json（分类标签、情绪场景、价格等），<strong>未改动 HTML / CSS 代码</strong>时使用。</p>
                                        {sectionLabel('执行流程')}
                                        <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                            <li>从 GitHub 逐一拉取所有模板的 config.json</li>
                                            <li>对比文件 SHA 指纹，筛出有变动的模板</li>
                                            <li>将新配置写入 KV，并覆盖 R2 中该版本的 config.json</li>
                                            <li>自动触发前台模板列表重建</li>
                                        </ol>
                                        {sectionLabel('故障排查')}
                                        <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>💡 当你只修改了 config.json（如：价格、分类、场景 ID）但前台没变化时使用。</p>
                                    </div>
                                    <button onClick={handleSyncMeta} disabled={loadingSyncMeta} className="btn" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', padding: '10px', marginTop: 'auto' }}>
                                        {loadingSyncMeta ? '同步中...' : '执行配置同步'}
                                    </button>
                                </>)}

                                {/* Card 2: 拉取最新代码 */}
                                {cardBase('#64748b', <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>🔄 拉取最新代码</div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeKV('KV Write × 变动数')}{badgeR2('R2 Put 大量')}</div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                        {sectionLabel('适用场景')}
                                        <p style={{ margin: '0 0 10px' }}>在 GitHub 上提交了模板的 <strong>HTML / CSS / JS 代码更改</strong>后使用；也可用于恢复被误删的 <code>__tmpl__</code> KV 记录。</p>
                                        {sectionLabel('执行流程')}
                                        <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                            <li>扫描 GitHub 所有模板文件夹</li>
                                            <li>对比 index.html 的 SHA 指纹，找出有变动的模板</li>
                                            <li>生成新版本号，将全部文件上传至 R2</li>
                                            <li>更新 KV 记录，旧版本进入 24h GC 等待队列</li>
                                        </ol>
                                        {sectionLabel('故障排查')}
                                        <p style={{ margin: 0, color: '#475569', fontWeight: 600 }}>💡 当你修改了 HTML/CSS/JS 代码但页面没更新，或模板在 KV 中丢失时使用。</p>
                                    </div>
                                    <button onClick={handleSync} disabled={loadingSync} className="btn" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '10px', marginTop: 'auto' }}>
                                        {loadingSync ? '同步中...' : '拉取最新代码'}
                                    </button>
                                </>)}

                                {/* Card 3: 刷新前台展示 */}
                                {cardBase('#10b981', <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>↻ 刷新前台展示</div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeKV('KV Read × 1')}{badgeNone('R2 无消耗')}</div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                        {sectionLabel('适用场景')}
                                        <p style={{ margin: '0 0 10px' }}>模板配置已更新，但<strong>前台大厅显示未刷新</strong>；或需要强制清理全球 CDN 缓存节点时使用。</p>
                                        {sectionLabel('执行流程')}
                                        <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                            <li>从 KV 列出所有模板数据</li>
                                            <li>重构 /opt/cache/templates.json 静态文件</li>
                                            <li>向 Cloudflare 推送全节点 CDN Purge 请求</li>
                                        </ol>
                                        {sectionLabel('故障排查')}
                                        <p style={{ margin: 0, color: '#059669', fontWeight: 600 }}>💡 当模板配置已改但前台大厅（首页）还是老数据，或 CDN 缓存不刷新时使用。</p>
                                    </div>
                                    <button onClick={handleGalleryRefresh} disabled={loadingGalleryRefresh} className="btn" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #6ee7b7', padding: '10px', marginTop: 'auto' }}>
                                        {loadingGalleryRefresh ? '刷新中...' : '刷新前台展示'}
                                    </button>
                                </>)}

                                {/* Card 4: 同步运行配置 */}
                                {cardBase('#0ea5e9', <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>🔧 同步运行配置</div>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeKV('KV Read × 2')}{badgeNone('R2 无消耗')}</div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                        {sectionLabel('适用场景')}
                                        <p style={{ margin: '0 0 10px' }}>在数据库中修改了<strong>会员等级配额</strong>（如创作上限）或<strong>域名黑名单</strong>后，需要立即生效，无需重启服务时使用。</p>
                                        {sectionLabel('执行流程')}
                                        <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                            <li>从 KV 读取 Quotas（等级配额）配置</li>
                                            <li>从 KV 读取 Blocklist（域名黑名单）配置</li>
                                            <li>将两份数据覆盖至 VPS 运行内存，立即生效</li>
                                        </ol>
                                        {sectionLabel('故障排查')}
                                        <p style={{ margin: 0, color: '#0284c7', fontWeight: 600 }}>💡 当你在KV里改了会员等级配额或域名黑名单，但系统还没反应时使用。</p>
                                    </div>
                                    <button onClick={handleSyncAllConfig} disabled={loadingSyncAll} className="btn" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #7dd3fc', padding: '10px', marginTop: 'auto' }}>
                                        {loadingSyncAll ? '同步中...' : '同步运行配置'}
                                    </button>
                                </>)}
                            </div>

                            {/* ─── Danger Zone ─────────────────────────────────────────── */}
                            <div style={{ border: '1.5px solid #fca5a5', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
                                <div style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>⛔</span>
                                    <div>
                                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>危险操作区</div>
                                        <div style={{ color: '#fecaca', fontSize: '0.75rem', marginTop: '2px' }}>以下操作不可撤销，请仔细阅读说明后再执行</div>
                                    </div>
                                </div>
                                <div style={{ padding: '16px', background: '#fff5f5', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Card 5: 清理旧版本文件 */}
                                    <div style={{ background: '#fff', border: '1px solid #fca5a5', borderLeft: '4px solid #f87171', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#dc2626' }}>🧹 清理旧版本文件</div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeNone('KV 无消耗')}{badgeRed('R2 Delete × N')}</div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                            {sectionLabel('适用场景')}
                                            <p style={{ margin: '0 0 10px' }}>执行「拉取最新代码」后，R2 中会保留旧版本文件作为 24 小时 CDN 缓冲。确认缓冲期过后再执行释放存储。</p>
                                            {sectionLabel('执行流程')}
                                            <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                                <li>读取 VPS 本地 <code>gc_queue.json</code> 列表</li>
                                                <li>筛选出超过 24 小时保护期的记录</li>
                                                <li>从 R2 批量物理删除这些旧版本文件夹</li>
                                                <li>更新并在本地移出已清理的记录</li>
                                            </ol>
                                            {sectionLabel('故障排查')}
                                            <p style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>💡 当 R2 存储占用过高、费用上涨时，可安全使用此功能日常清理。</p>
                                        </div>
                                        <button onClick={handlePrune} disabled={loadingPrune} className="btn" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '10px', marginTop: 'auto' }}>
                                            {loadingPrune ? '清理中...' : '清理旧版本文件'}
                                        </button>
                                    </div>

                                    {/* Card 6: 深度扫描 */}
                                    <div style={{ background: '#fff', border: '1px solid #ef4444', borderLeft: '4px solid #b91c1c', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#b91c1c' }}>🔍 深度扫描残余 (Deep Sweep)</div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeKV('KV Read × N')}{badgeRed('R2 Delete × N')}</div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                            {sectionLabel('适用场景')}
                                            <p style={{ margin: '0 0 10px' }}>当 R2 存储占用与实际不符，存在游离于 KV 与正常 GC 队列外的大量幽灵碎片时，执行暴力全局扫描清洗。</p>
                                            {sectionLabel('执行流程')}
                                            <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                                <li>读取云端全量 KV 中的 <code>version</code> 版本号</li>
                                                <li>读取 R2 中的所有 <code>templates/</code> 真实物理资源列表</li>
                                                <li>无视安全保护，直接强制删除所有不在 KV 列表和临时 24H 本地保护名单中的隐身资源</li>
                                            </ol>
                                            {sectionLabel('排查异常')}
                                            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>💡 当发现 VPS 系统遭遇重启 / 磁盘被清空导致本地 GC 数据丢失，常规清理已经无法找出遗留垃圾时执行。</p>
                                        </div>
                                        <button onClick={handleDeepSweep} disabled={loadingDeepSweep} className="btn" style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '10px', marginTop: 'auto' }}>
                                            {loadingDeepSweep ? '扫描清理中...' : '强制深度扫描'}
                                        </button>
                                    </div>
                                    
                                    {/* Card 7: 全网 CDN 强刷 */}
                                    <div style={{ background: '#fff', border: '1px solid #fca5a5', borderLeft: '4px solid #ea580c', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ea580c' }}>🌪 全站 CDN 强刷</div>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{badgeNone('Cloudflare API')}</div>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                            {sectionLabel('适用场景')}
                                            <p style={{ margin: '0 0 10px' }}>强刷整个服务器全部用户的 Cloudflare 边缘节点缓存。<strong>将导致全网下次访问全部回源，流量消耗飙升</strong>。</p>
                                            {sectionLabel('执行流程')}
                                            <ol style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
                                                <li>对绑定的 Cloudflare 服务端接口请求 <code>purge_everything</code></li>
                                                <li>全球边缘节点强制废弃现存的缓存副本</li>
                                                <li>用户设备下一秒访问时重新穿透获取当前 R2 最新的文件并生成新缓存</li>
                                            </ol>
                                            {sectionLabel('极端排查')}
                                            <p style={{ margin: 0, color: '#ea580c', fontWeight: 600 }}>💡 仅用于进行紧急的平台层 Bug 修正（比如首页核心 JS 报错），需要强迫全网数十万访问者不计成本立即刷新时动用此核按钮。</p>
                                        </div>
                                        <button onClick={handlePurgeAll} disabled={loadingPurgeAll} className="btn" style={{ background: '#fed7aa', color: '#c2410c', border: '1px solid #fb923c', padding: '10px', marginTop: 'auto' }}>
                                            {loadingPurgeAll ? '全站强刷中...' : '确认强刷全网缓存'}
                                        </button>
                                    </div>

                                    {/* Card 8: 删除模板说明 */}
                                    <div style={{ background: '#fff', border: '1px solid #fca5a5', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#d97706' }}>🗑️ 删除模板指示</div>
                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.75 }}>
                                            {sectionLabel('操作入口')}
                                            <p style={{ margin: '0 0 10px' }}>请在 <strong>🎨 模板中心</strong> 的列表中点击「删除」。</p>
                                            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', fontSize: '0.78rem', color: '#9a3412', marginTop: 'auto', lineHeight: 1.6 }}>
                                                💡 此操作将立即导致老用户页面报 404 错误。
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })() : (

                    /* ═══════════════════════════════════════════════════════════ */
                    /* TAB 3: 日常运营（无 KV/R2 消耗）                          */
                    /* ═══════════════════════════════════════════════════════════ */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', fontSize: '0.82rem', color: '#166534' }}>
                            ✅ 以下操作数据源为 <strong>Supabase 数据库</strong>，<strong>不消耗任何 KV / R2 额度</strong>
                        </div>

                        {/* Tier Management */}
                        <div className="builder-card">
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                👤 权限与配额调试
                                <button onClick={fetchTiers} disabled={loadingTier} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🔄</button>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                {Object.keys(tiers).sort((a, b) => (tiers[a].limit || 0) - (tiers[b].limit || 0)).map(t => (
                                    <div key={t} style={{ padding: '12px 20px', borderRadius: '12px', background: currentTier === t.toLowerCase() ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff', color: currentTier === t.toLowerCase() ? '#fff' : '#334155', boxShadow: currentTier === t.toLowerCase() ? '0 4px 12px rgba(16,185,129,0.2)' : '0 1px 3px rgba(0,0,0,0.05)', border: currentTier === t.toLowerCase() ? 'none' : '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700 }}>{tiers[t].label}</span>
                                        <button onClick={() => handleUpdateTier(t)} disabled={loadingTier || currentTier === t.toLowerCase()} style={{ padding: '5px 15px', borderRadius: '20px', border: 'none', background: currentTier === t.toLowerCase() ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: currentTier === t.toLowerCase() ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                            {currentTier === t.toLowerCase() ? '当前持有' : '测试切换'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                                💡 点击「测试切换」可临时模拟不同会员等级的权限表现（写入 Supabase）。若后端修改了配额数值，点击 🔄 刷新对照显示。
                            </p>
                            {msg.tier.error && <div className="alert alert--error" style={{ marginTop: '15px' }}>{msg.tier.error}</div>}
                            {msg.tier.success && <div className="alert alert--success" style={{ marginTop: '15px' }}>{msg.tier.success}</div>}
                        </div>

                        {/* Pricing Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '30px', alignItems: 'start' }}>
                            {/* Pricing Form */}
                            <div className="builder-card" style={{ position: 'sticky', top: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {editingPricing ? '📝 编辑套餐' : '✨ 新建套餐'}
                                </h3>
                                <form onSubmit={handlePricingSubmit}>
                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>PLAN ID</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                                <label style={{ fontSize: '0.8rem' }}>会员等级</label>
                                                <select value={pricingForm.tier} onChange={e => setPricingForm({ ...pricingForm, tier: e.target.value })}>
                                                    {Object.keys(tiers).length > 0 ? Object.keys(tiers).sort((a, b) => (tiers[a].limit || 0) - (tiers[b].limit || 0)).map(t => (
                                                        <option key={t} value={t}>{tiers[t].label || t.toUpperCase()}</option>
                                                    )) : (<><option value="pro">Pro 专业版</option><option value="partner">Partner 合伙人</option><option value="lifetime">Lifetime 终身</option></>)}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                                <label style={{ fontSize: '0.8rem' }}>排序权重</label>
                                                <input type="text" pattern="^\d+$" value={pricingForm.sort_order} onChange={e => setPricingForm({ ...pricingForm, sort_order: e.target.value })} placeholder="0" />
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                                            <label style={{ fontSize: '0.8rem' }}>前台展示名称</label>
                                            <input type="text" value={pricingForm.display_name} onChange={e => setPricingForm({ ...pricingForm, display_name: e.target.value })} placeholder="如：月度会员 · 专业版" />
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>计费模式</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {[{ key: 'first_month_discount', label: '首月折扣 + 续费原价', desc: '首月低价引流，次月起按原价续费' }, { key: 'fixed', label: '固定价格', desc: '购买即固定价，无首月/续费区分' }, { key: 'resident_discount', label: '常驻折扣套餐', desc: '季度/年度等长周期一次性优惠续费' }].map(opt => (
                                                <label key={opt.key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: `1.5px solid ${pricingForm.pricing_type === opt.key ? 'var(--pink)' : '#e2e8f0'}`, background: pricingForm.pricing_type === opt.key ? '#fff0f3' : '#fff', transition: 'all 0.15s' }}>
                                                    <input type="radio" name="pricing_type" value={opt.key} checked={pricingForm.pricing_type === opt.key} onChange={() => setPricingForm({ ...pricingForm, pricing_type: opt.key })} style={{ marginTop: '2px', accentColor: 'var(--pink)' }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{opt.label}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>价格配置（单位：元）</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                                <label style={{ fontSize: '0.8rem' }}>有效时长（月）</label>
                                                <input type="text" pattern="^\d+$" value={pricingForm.duration_months} onChange={e => setPricingForm({ ...pricingForm, duration_months: e.target.value })} placeholder="1" />
                                            </div>
                                            <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                                <label style={{ fontSize: '0.8rem' }}>划线原价 ¥（必填）</label>
                                                <input type="text" inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={pricingForm.base_price_yuan} onChange={e => setPricingForm({ ...pricingForm, base_price_yuan: e.target.value })} placeholder="99.00" />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px' }}>
                                            <div className="form-group" style={{ margin: '0 0 10px 0' }}>
                                                <label style={{ fontSize: '0.8rem' }}>{pricingForm.pricing_type === 'first_month_discount' ? '首月价格 ¥' : pricingForm.pricing_type === 'resident_discount' ? '套餐优惠价 ¥' : '固定价格 ¥'}</label>
                                                <input type="text" inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={pricingForm.intro_price_yuan} onChange={e => setPricingForm({ ...pricingForm, intro_price_yuan: e.target.value })} placeholder="9.90" />
                                            </div>
                                            {pricingForm.pricing_type !== 'fixed' && (
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label style={{ fontSize: '0.8rem' }}>续费价格 ¥{pricingForm.pricing_type === 'resident_discount' ? '（可选）' : '（必填）'}</label>
                                                    <input type="text" inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={pricingForm.renewal_price_yuan} onChange={e => setPricingForm({ ...pricingForm, renewal_price_yuan: e.target.value })} placeholder={pricingForm.pricing_type === 'first_month_discount' ? '29.00' : '留空则同套餐价'} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>促销与上架状态</div>
                                        <div className="form-group" style={{ marginBottom: '12px' }}>
                                            <label style={{ fontSize: '0.8rem' }}>促销展示标签（如：限时5折、最热门）</label>
                                            <input type="text" value={pricingForm.discount_label} onChange={e => setPricingForm({ ...pricingForm, discount_label: e.target.value })} placeholder="限时特惠" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setPricingForm({ ...pricingForm, is_active: !pricingForm.is_active })}>
                                                <input type="checkbox" checked={pricingForm.is_active} readOnly style={{ accentColor: 'var(--pink)', width: '16px', height: '16px' }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>立即上架</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setPricingForm({ ...pricingForm, allow_renewal: !pricingForm.allow_renewal })}>
                                                <input type="checkbox" checked={pricingForm.allow_renewal} readOnly style={{ accentColor: 'var(--pink)', width: '16px', height: '16px' }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>允许续费</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'linear-gradient(135deg, #fff0f3, #fce7f3)', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#9f1239', lineHeight: 1.5 }}>
                                        💡 <strong>计费预览：</strong>{getPricingPreview()}
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={loadingPricing}>
                                            {loadingPricing ? '提交中...' : (editingPricing ? '保存修改' : '创建套餐')}
                                        </button>
                                        {editingPricing && (
                                            <button type="button" className="btn btn--outline" onClick={() => { setEditingPricing(null); setPricingForm({ ...BLANK_PRICING_FORM }); }}>取消</button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* Pricing List */}
                            <div className="builder-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>📋 现有套餐 ({pricingConfigs.length})</h3>
                                    <button className="btn btn--sm" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #6ee7b7' }} onClick={() => fetchPricing(adminKey)}>刷新</button>
                                </div>
                                {loadingPricing ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>加载中...</div>
                                ) : pricingConfigs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>暂无套餐，请从左侧创建</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[...pricingConfigs].sort((a, b) => { if ((a.limit || 0) !== (b.limit || 0)) return (a.limit || 0) - (b.limit || 0); return (a.sort_order || 0) - (b.sort_order || 0); }).map(c => {
                                            const hasFirstMonth = c.first_month_price != null && c.first_month_price > 0;
                                            const hasRenewal = c.renewal_price != null && c.renewal_price > 0;
                                            const isFirstMonthDiscount = hasFirstMonth && hasRenewal && c.first_month_price !== c.renewal_price;
                                            const isResidentDiscount = !isFirstMonthDiscount && c.duration_months > 1;
                                            const typeLabel = isFirstMonthDiscount ? '首月折扣' : isResidentDiscount ? '常驻折扣' : '固定价格';
                                            const typeColor = isFirstMonthDiscount ? '#2563eb' : isResidentDiscount ? '#7c3aed' : '#064e3b';
                                            const typeBg = isFirstMonthDiscount ? '#eff6ff' : isResidentDiscount ? '#f5f3ff' : '#ecfdf5';
                                            let priceDesc = '';
                                            if (isFirstMonthDiscount) priceDesc = `首月 ¥${centsToYuan(c.first_month_price)}，续费 ¥${centsToYuan(c.renewal_price)}/月`;
                                            else if (isResidentDiscount) priceDesc = `¥${centsToYuan(c.first_month_price)} / ${c.duration_months}个月${c.renewal_price ? `，续费 ¥${centsToYuan(c.renewal_price)}` : ''}`;
                                            else priceDesc = `¥${centsToYuan(c.first_month_price || c.base_price)} 固定价`;
                                            return (
                                                <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: c.is_active ? '#fff' : '#f8fafc', opacity: c.is_active ? 1 : 0.6, display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{c.display_name || c.tier.toUpperCase()}</span>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: typeBg, color: typeColor }}>{typeLabel}</span>
                                                            {c.discount_label && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#fef3c7', color: '#92400e' }}>{c.discount_label}</span>}
                                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: c.is_active ? '#ecfdf5' : '#fef2f2', color: c.is_active ? '#059669' : '#dc2626' }}>{c.is_active ? '上架中' : '已下架'}</span>
                                                            {c.allow_renewal === false && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>🚫 不可续费</span>}
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '4px' }}>
                                                            <strong style={{ color: '#f43f5e' }}>{priceDesc}</strong>
                                                            <span style={{ marginLeft: '10px', textDecoration: 'line-through', color: '#cbd5e1' }}>划线 ¥{centsToYuan(c.base_price)}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.tier.toUpperCase()} · {c.duration_months}个月 · 排序 #{c.sort_order ?? 0}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn btn--sm" style={{ padding: '5px 12px', border: '1px solid #e2e8f0' }} onClick={() => startEditPricing(c)}>编辑</button>
                                                        <button className="btn btn--sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '5px 12px' }} onClick={() => handleDeletePricing(c.id)}>删除</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `.admin-table tr:hover { background-color: #f8fafc; } .admin-content button:disabled { opacity: 0.6; cursor: not-allowed; }` }} />
        </div>
    );
}

