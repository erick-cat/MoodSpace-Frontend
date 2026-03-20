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
    deletePricingConfig
} from '../api/client.js';
import { supabase } from '../lib/supabase.js';

export default function Admin() {
    const [activeTab, setActiveTab] = useState('templates'); // 'templates' or 'system'
    const [adminKey, setAdminKey] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [files, setFiles] = useState([]);
    const [detectedTitle, setDetectedTitle] = useState('');
    const [existingTemplates, setExistingTemplates] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);
    const [loadingSyncAll, setLoadingSyncAll] = useState(false);
    const [loadingGalleryRefresh, setLoadingGalleryRefresh] = useState(false);
    const [loadingTier, setLoadingTier] = useState(false);
    const [loadingPrune, setLoadingPrune] = useState(false);
    const [loadingDelete, setLoadingDelete] = useState(null); // stores template name being deleted
    const [loadingStatusChange, setLoadingStatusChange] = useState(null); // stores template name for status toggling
    
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
            } catch(e) {}
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

    const handleSync = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));

        const confirmed = window.confirm(
            '⚠️ 确认同步仓库代码？\n\n' +
            '这将从 GitHub 拉取所有模板文件夹的最新源码并写入 R2 存储。\n\n' +
            '消耗估算：\n' +
            '• N 次 R2 Class A (写入新文件)\n' +
            '• 1 次 KV Class A (更新模板路由)\n\n' +
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
            '⚠️ 确认同步系统配置？\n\n' +
            '这将从云端 KV 拉取最新的等级配额和黑名单数据，并重置 VPS 运行内存。\n\n' +
            '消耗估算：\n' +
            '• 2 次 KV Class B (获取 Quotas & Blocklist)\n\n' +
            '是否继续？'
        );
        if (!confirmed) return;

        clearMsgs();
        setLoadingSyncAll(true);
        saveAdminKey(adminKey);

        try {
            const res = await syncAllConfig(adminKey);
            setMsg(prev => ({ ...prev, main: { success: res.message, error: null } }));
        } catch (err) {
            setMsg(prev => ({ ...prev, main: { error: '同步失败: ' + getErrorMessage(err), success: null } }));
        } finally {
            setLoadingSyncAll(false);
        }
    };

    const handleGalleryRefresh = async () => {
        if (!adminKey) return setMsg(prev => ({ ...prev, main: { error: '请输入管理员密钥' } }));
        
        const confirmed = window.confirm(
            '⚠️ 确认刷新模板大厅？\n\n' +
            '这将强制重构 templates.json 静态文件，重置后端缓存，并清理 CDN 边缘缓存节点。\n\n' +
            '消耗估算：\n' +
            '• 1 次 KV Class A (列出所有模板)\n' +
            '• 1 次 Cloudflare Purge (清理全球缓存)\n\n' +
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
                return `${durLabel}套餐一次性优惠价 ¥${intro_price_yuan}（划线 ¥${base_price_yuan || '--'}），续费${ renewal_price_yuan ? ` ¥${renewal_price_yuan}` : '同价'}`;  
        }
        return '请填写价格以预览计费规则';
    };

    return (
        <div className="page container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 className="section-title">🛡️ 管理控制台</h1>
                <p className="section-sub">{import.meta.env.VITE_APP_NAME ?? 'Emotional Space'} 核心引擎调度与资源管理</p>
            </div>

            {/* Admin Key Global Input */}
            <div className="builder-card" style={{ padding: '15px 25px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px', background: '#fff', border: '1px solid #eee' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', marginBottom: '5px', display: 'block' }}>🔑 超级管理员密钥 (身份标识)</label>
                    <input
                        type="password"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        placeholder="请输入授权密钥以执行敏感操作"
                        style={{ margin: 0, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                    />
                </div>
            </div>

            {/* Alerts Container */}
            <div style={{ marginBottom: '20px' }}>
                {msg.main.error && <div className="alert alert--error" style={{ marginBottom: '10px' }}>{msg.main.error}</div>}
                {msg.main.success && <div className="alert alert--success" style={{ marginBottom: '10px' }}>{msg.main.success}</div>}
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '30px' }}>
                <button
                    onClick={() => setActiveTab('templates')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'templates' ? '2px solid var(--pink)' : 'none',
                        color: activeTab === 'templates' ? 'var(--pink-dark)' : '#64748b',
                        fontWeight: activeTab === 'templates' ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    🎨 模板中心
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'system' ? '2px solid var(--pink)' : 'none',
                        color: activeTab === 'system' ? 'var(--pink-dark)' : '#64748b',
                        fontWeight: activeTab === 'system' ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    ⚙️ 系统架构
                </button>
                <button
                    onClick={() => { setActiveTab('pricing'); fetchPricing(adminKey); }}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'pricing' ? '2px solid var(--pink)' : 'none',
                        color: activeTab === 'pricing' ? 'var(--pink-dark)' : '#64748b',
                        fontWeight: activeTab === 'pricing' ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    💰 套餐定价
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'templates' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '30px' }}>
                        {/* Template Upload Form */}
                        <div className="builder-card" style={{ height: 'fit-content' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#333' }}>🚀 发布新模板</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>模板英文名 ID</label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        placeholder="例如：anniversary_modern"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>本地代码打包</label>
                                    <div style={{ border: '2px dashed #eee', padding: '20px', textAlign: 'center', borderRadius: '10px', background: '#fafafa', position: 'relative' }}>
                                        <input type="file" multiple onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                        <p style={{ margin: 0, color: '#666' }}>{files.length > 0 ? `已选中 ${files.length} 个文件` : "点击上传源文件"}</p>
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

                        {/* Existing Templates List */}
                        <div className="builder-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
                                <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#333' }}>📋 模板库 ({existingTemplates.length})</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                   <input
                                       type="text"
                                       placeholder="搜索 ID 或名称..."
                                       value={searchQuery}
                                       onChange={(e) => setSearchQuery(e.target.value)}
                                       style={{ margin: 0, padding: '5px 10px', width: '120px', fontSize: '0.85rem' }}
                                   />
                                   <button 
                                       onClick={handleSync} 
                                       className="btn btn--sm" 
                                       disabled={loadingSync} 
                                       style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
                                       title="当开发者向 GitHub 提交了新代码，或者您想批量从仓库拉取最新的模板改动时使用。系统会自动识别差异并仅更新有变动的部分。"
                                   >
                                       {loadingSync ? '...' : '🔄 同步代码'}
                                   </button>
                                   <button 
                                       onClick={handleGalleryRefresh} 
                                       className="btn btn--sm" 
                                       disabled={loadingGalleryRefresh} 
                                       style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #6ee7b7' }}
                                       title="当您修改了模板但前台大厅没有即时刷新，或者需要强制清理全球 CDN 缓存以确保用户看到最新版本时使用。"
                                   >
                                       {loadingGalleryRefresh ? '...' : '↻ 重置缓存'}
                                   </button>
                                </div>
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
                                            {existingTemplates
                                                .filter(t =>
                                                    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase()))
                                                )
                                                .map(tmpl => {
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
                                                                    <button
                                                                        onClick={() => handleToggleStatus(tmpl)}
                                                                        className="btn btn--sm"
                                                                        disabled={loadingStatusChange === tmpl.name}
                                                                        style={{ background: isActive ? '#fff7ed' : '#ecfdf5', color: isActive ? '#ea580c' : '#059669', border: `1px solid ${isActive ? '#fed7aa' : '#6ee7b7'}`, padding: '4px 10px' }}
                                                                    >
                                                                        {loadingStatusChange === tmpl.name ? '...' : (isActive ? '下架' : '上架')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteTemplate(tmpl.name)}
                                                                        className="btn btn--sm"
                                                                        disabled={loadingDelete === tmpl.name}
                                                                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '4px 10px' }}
                                                                    >
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
                ) : activeTab === 'pricing' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '30px', alignItems: 'start' }}>
                        {/* Pricing Form */}
                        <div className="builder-card" style={{ position: 'sticky', top: '20px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {editingPricing ? '📝 编辑套餐' : '✨ 新建套餐'}
                            </h3>
                            <form onSubmit={handlePricingSubmit}>
                                {/* ─ Section 1: Identity ─ */}
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>PLAN ID</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                            <label style={{ fontSize: '0.8rem' }}>会员等级</label>
                                            <select value={pricingForm.tier} onChange={e => setPricingForm({...pricingForm, tier: e.target.value})}>
                                                <option value="pro">Pro 专业版</option>
                                                <option value="partner">Partner 合伙人</option>
                                                <option value="lifetime">Lifetime 终身</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                            <label style={{ fontSize: '0.8rem' }}>排序权重</label>
                                            <input
                                                type="text"
                                                pattern="^\d+$"
                                                value={pricingForm.sort_order}
                                                onChange={e => setPricingForm({...pricingForm, sort_order: e.target.value})}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>前台展示名称</label>
                                        <input
                                            type="text"
                                            value={pricingForm.display_name}
                                            onChange={e => setPricingForm({...pricingForm, display_name: e.target.value})}
                                            placeholder="如：月度会员 · 专业版"
                                        />
                                    </div>
                                </div>

                                {/* ─ Section 2: Pricing Type ─ */}
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>计费模式</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[
                                            { key: 'first_month_discount', label: '首月折扣 + 续费原价', desc: '首月低价引流，次月起按原价续费' },
                                            { key: 'fixed', label: '固定价格', desc: '购买即固定价，无首月/续费区分' },
                                            { key: 'resident_discount', label: '常驻折扣套餐', desc: '季度/年度等长周期一次性优惠续费' },
                                        ].map(opt => (
                                            <label key={opt.key} style={{
                                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                                border: `1.5px solid ${pricingForm.pricing_type === opt.key ? 'var(--pink)' : '#e2e8f0'}`,
                                                background: pricingForm.pricing_type === opt.key ? '#fff0f3' : '#fff',
                                                transition: 'all 0.15s'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name="pricing_type"
                                                    value={opt.key}
                                                    checked={pricingForm.pricing_type === opt.key}
                                                    onChange={() => setPricingForm({...pricingForm, pricing_type: opt.key})}
                                                    style={{ marginTop: '2px', accentColor: 'var(--pink)' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{opt.label}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* ─ Section 3: Price Fields ─ */}
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>价格配置（单位：元）</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                            <label style={{ fontSize: '0.8rem' }}>有效时长（月）</label>
                                            <input
                                                type="text"
                                                pattern="^\d+$"
                                                value={pricingForm.duration_months}
                                                onChange={e => setPricingForm({...pricingForm, duration_months: e.target.value})}
                                                placeholder="1"
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                                            <label style={{ fontSize: '0.8rem' }}>划线原价 ¥（必填）</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                pattern="^\d+(\.\d{1,2})?$"
                                                value={pricingForm.base_price_yuan}
                                                onChange={e => setPricingForm({...pricingForm, base_price_yuan: e.target.value})}
                                                placeholder="99.00"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <div className="form-group" style={{ margin: '0 0 10px 0' }}>
                                            <label style={{ fontSize: '0.8rem' }}>
                                                {pricingForm.pricing_type === 'first_month_discount' ? '首月价格 ¥' :
                                                 pricingForm.pricing_type === 'resident_discount' ? '套餐优惠价 ¥' : '固定价格 ¥'}
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                pattern="^\d+(\.\d{1,2})?$"
                                                value={pricingForm.intro_price_yuan}
                                                onChange={e => setPricingForm({...pricingForm, intro_price_yuan: e.target.value})}
                                                placeholder="9.90"
                                            />
                                        </div>
                                        {pricingForm.pricing_type !== 'fixed' && (
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.8rem' }}>续费价格 ¥{pricingForm.pricing_type === 'resident_discount' ? '（可选）' : '（必填）'}</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    pattern="^\d+(\.\d{1,2})?$"
                                                    value={pricingForm.renewal_price_yuan}
                                                    onChange={e => setPricingForm({...pricingForm, renewal_price_yuan: e.target.value})}
                                                    placeholder={pricingForm.pricing_type === 'first_month_discount' ? '29.00' : '留空则同套餐价'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ─ Section 4: Labels & Status ─ */}
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '10px', letterSpacing: '0.05em' }}>促销与上架状态</div>
                                    <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '0.8rem' }}>促销展示标签（如：限时5折、最热门）</label>
                                        <input
                                            type="text"
                                            value={pricingForm.discount_label}
                                            onChange={e => setPricingForm({...pricingForm, discount_label: e.target.value})}
                                            placeholder="限时特惠"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setPricingForm({...pricingForm, is_active: !pricingForm.is_active})}>
                                            <input
                                                type="checkbox"
                                                checked={pricingForm.is_active}
                                                readOnly
                                                style={{ accentColor: 'var(--pink)', width: '16px', height: '16px' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>立即上架</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setPricingForm({...pricingForm, allow_renewal: !pricingForm.allow_renewal})}>
                                            <input
                                                type="checkbox"
                                                checked={pricingForm.allow_renewal}
                                                readOnly
                                                style={{ accentColor: 'var(--pink)', width: '16px', height: '16px' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>允许续费</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ─ Policy Preview ─ */}
                                <div style={{ background: 'linear-gradient(135deg, #fff0f3, #fce7f3)', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#9f1239', lineHeight: 1.5 }}>
                                    💡 <strong>计费预览：</strong> {getPricingPreview()}
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={loadingPricing}>
                                        {loadingPricing ? '提交中...' : (editingPricing ? '保存修改' : '创建套餐')}
                                    </button>
                                    {editingPricing && (
                                        <button type="button" className="btn btn--outline" onClick={() => {
                                            setEditingPricing(null);
                                            setPricingForm({ ...BLANK_PRICING_FORM });
                                        }}>取消</button>
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
                                    {pricingConfigs.map(c => {
                                        // Determine policy type label
                                        const hasFirstMonth = c.first_month_price != null && c.first_month_price > 0;
                                        const hasRenewal = c.renewal_price != null && c.renewal_price > 0;
                                        const isFirstMonthDiscount = hasFirstMonth && hasRenewal && c.first_month_price !== c.renewal_price;
                                        const isResidentDiscount = !isFirstMonthDiscount && c.duration_months > 1;
                                        const typeLabel = isFirstMonthDiscount ? '首月折扣' : isResidentDiscount ? '常驻折扣' : '固定价格';
                                        const typeColor = isFirstMonthDiscount ? '#2563eb' : isResidentDiscount ? '#7c3aed' : '#064e3b';
                                        const typeBg = isFirstMonthDiscount ? '#eff6ff' : isResidentDiscount ? '#f5f3ff' : '#ecfdf5';

                                        // Build pricing description
                                        let priceDesc = '';
                                        if (isFirstMonthDiscount)
                                            priceDesc = `首月 ¥${centsToYuan(c.first_month_price)}，续费 ¥${centsToYuan(c.renewal_price)}/月`;
                                        else if (isResidentDiscount)
                                            priceDesc = `¥${centsToYuan(c.first_month_price)} / ${c.duration_months}个月${c.renewal_price ? `，续费 ¥${centsToYuan(c.renewal_price)}` : ''}`;
                                        else
                                            priceDesc = `¥${centsToYuan(c.first_month_price || c.base_price)} 固定价`;

                                        return (
                                            <div key={c.id} style={{
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                padding: '16px',
                                                background: c.is_active ? '#fff' : '#f8fafc',
                                                opacity: c.is_active ? 1 : 0.6,
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto',
                                                gap: '12px',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                                                            {c.display_name || c.tier.toUpperCase()}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: typeBg, color: typeColor }}>
                                                            {typeLabel}
                                                        </span>
                                                        {c.discount_label && (
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#fef3c7', color: '#92400e' }}>
                                                                {c.discount_label}
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
                                                            background: c.is_active ? '#ecfdf5' : '#fef2f2',
                                                            color: c.is_active ? '#059669' : '#dc2626'
                                                        }}>
                                                            {c.is_active ? '上架中' : '已下架'}
                                                        </span>
                                                        {c.allow_renewal === false && (
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>
                                                                🚫 不可续费
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '4px' }}>
                                                        <strong style={{ color: '#f43f5e' }}>{priceDesc}</strong>
                                                        <span style={{ marginLeft: '10px', textDecoration: 'line-through', color: '#cbd5e1' }}>
                                                            划线 ¥{centsToYuan(c.base_price)}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                        {c.tier.toUpperCase()} · {c.duration_months}个月 · 排序 #{c.sort_order ?? 0}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        className="btn btn--sm"
                                                        style={{ padding: '5px 12px', border: '1px solid #e2e8f0' }}
                                                        onClick={() => startEditPricing(c)}
                                                    >编辑</button>
                                                    <button
                                                        className="btn btn--sm"
                                                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', padding: '5px 12px' }}
                                                        onClick={() => handleDeletePricing(c.id)}
                                                    >删除</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '30px' }}>
                        {/* Membership & Rights */}
                        <div className="builder-card">
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                👤 权限与配额管理
                                <button onClick={fetchTiers} disabled={loadingTier} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🔄</button>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                {Object.keys(tiers).map(t => (
                                    <div key={t} style={{
                                        padding: '12px 20px',
                                        borderRadius: '12px',
                                        background: currentTier === t.toLowerCase() ? 'linear-gradient(135deg, #10b981, #059669)' : '#fff',
                                        color: currentTier === t.toLowerCase() ? '#fff' : '#334155',
                                        boxShadow: currentTier === t.toLowerCase() ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                                        border: currentTier === t.toLowerCase() ? 'none' : '1px solid #e2e8f0',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <span style={{ fontWeight: 700 }}>{tiers[t].label}</span>
                                        <button
                                            onClick={() => handleUpdateTier(t)}
                                            disabled={loadingTier || currentTier === t.toLowerCase()}
                                            style={{
                                                padding: '5px 15px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                background: currentTier === t.toLowerCase() ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                                                color: currentTier === t.toLowerCase() ? '#fff' : '#475569',
                                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                                            }}
                                        >
                                            {currentTier === t.toLowerCase() ? '当前持有' : '测试切换'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px', lineHeight: 1.4 }}>
                                💡 <strong>使用场景：</strong> 这里的配置数据是从数据库拉取的。如果您在后端代码或云端手动修改了各等级的配额（如作品上限），点击上方 <b>🔄</b> 刷新；点击右侧 <b>测试切换</b> 可临时模拟不同等级的权限表现。
                            </p>
                            {msg.tier.error && <div className="alert alert--error" style={{ marginTop: '15px' }}>{msg.tier.error}</div>}
                            {msg.tier.success && <div className="alert alert--success" style={{ marginTop: '15px' }}>{msg.tier.success}</div>}
                        </div>

                        {/* Engine & R2 Operations */}
                        <div className="builder-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>⚡ 核心调度与清理</h3>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                <button
                                    className="btn"
                                    onClick={handleSyncAllConfig}
                                    disabled={loadingSyncAll}
                                    style={{
                                        flexDirection: 'row', padding: '20px', height: 'auto', gap: '15px',
                                        background: '#ecfdf5',
                                        border: '1px solid #6ee7b7',
                                    }}
                                    title="一键同步云端 KV 所有的等级配额和黑名单配置到 VPS 内存"
                                >
                                    <span style={{ fontSize: '1.4rem' }}>🔄</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 700 }}>同步系统配置</div>
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                            手动触发 VPS 内存配置刷新
                                        </div>
                                    </div>
                                </button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px', lineHeight: 1.4 }}>
                                💡 <strong>使用场景：</strong> 当您在数据库中修改了会员等级配额或域名黑名单后，点击此项可立即同步到 VPS 运行内存中生效。
                            </p>
                            <button
                                onClick={handlePrune}
                                disabled={loadingPrune}
                                className="btn"
                                style={{ width: '100%', marginTop: '15px', background: '#dc2626', color: '#fff', border: 'none', padding: '12px' }}
                            >
                                {loadingPrune ? '深度清理中...' : '🧹 深度清理 R2 存储残留版本'}
                            </button>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px', lineHeight: 1.4 }}>
                                💡 <strong>使用场景：</strong> 当系统中存在大量旧版本残留，且您确定不再需要回退这些版本时，点击进行物理删除以释放 R2 存储空间（不可撤销）。
                            </p>
                            {msg.kv.error && <div className="alert alert--error" style={{ marginTop: '15px' }}>{msg.kv.error}</div>}
                            {msg.kv.success && <div className="alert alert--success" style={{ marginTop: '15px' }}>{msg.kv.success}</div>}
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .admin-table tr:hover { background-color: #f8fafc; }
                .admin-content button:disabled { opacity: 0.6; cursor: not-allowed; }
            ` }} />
        </div>
    );
}
