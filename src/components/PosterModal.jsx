import { useEffect, useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

/**
 * PosterModal — renders a shareable poster for a MoodSpace project.
 * Props:
 *   isOpen        — boolean
 *   onClose       — () => void
 *   projectUrl    — full URL: https://xxx.moodspace.xyz
 *   title         — project memo / page title
 *   templateTitle — human-readable template title (e.g. "星空告白")
 *   templateName  — technical template name (slug) for asset lookup
 *   rawHtml       — optional: the template's full HTML string for srcdoc preview
 *                   (avoids X-Frame-Options cross-origin block)
 */
export default function PosterModal({ isOpen, onClose, projectUrl, title, templateTitle, templateName, rawHtml }) {
    const posterRef = useRef(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [generating, setGenerating] = useState(false);
    const [srcdoc, setSrcdoc] = useState('');
    const [imageFailed, setImageFailed] = useState(false);

    // Reset failure state when template changes
    useEffect(() => {
        setImageFailed(false);
    }, [templateName]);

    // Generate QR code whenever URL changes
    useEffect(() => {
        if (!projectUrl) return;
        QRCode.toDataURL(projectUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#1a1036', light: '#ffffff' },
            errorCorrectionLevel: 'M',
        }).then(setQrDataUrl).catch(console.error);
    }, [projectUrl]);

    // Build srcdoc — inject base tag so assets load correctly, strip animations for screenshot
    useEffect(() => {
        if (!rawHtml || !isOpen) return;

        // Extract subdomain from URL to build asset base
        let assetBase = '';
        try {
            const url = new URL(projectUrl);
            // assets are served from www.moodspace.xyz/assets/<template>/
            assetBase = `https://www.moodspace.xyz/assets/`;
        } catch { /* ignore */ }

        // Inject base tag + freeze animations for a clean screenshot
        const styleOverride = `<style>
            *,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}
            ::-webkit-scrollbar{display:none!important}
            body{overflow:hidden!important;pointer-events:none!important;}
        </style>`;

        let html = rawHtml;
        const headMatch = html.match(/<head[^>]*>/i);
        if (headMatch) {
            html = html.replace(headMatch[0], headMatch[0] + styleOverride);
        } else {
            html = styleOverride + html;
        }
        setSrcdoc(html);
    }, [rawHtml, isOpen, projectUrl]);

    const handleDownload = useCallback(async () => {
        if (!posterRef.current) return;
        setGenerating(true);
        try {
            const canvas = await html2canvas(posterRef.current, {
                scale: 3,              // 3x resolution for crisp mobile screenshots
                useCORS: true,
                allowTaint: false,
                backgroundColor: null,
                logging: false,
                // Ignore the iframe — html2canvas can't capture cross-origin content
                ignoreElements: (el) => el.tagName === 'IFRAME',
            });
            const link = document.createElement('a');
            link.download = `moodspace-poster-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('[Poster] html2canvas error', err);
        } finally {
            setGenerating(false);
        }
    }, []);

    if (!isOpen) return null;

    const displayTitle = title && title !== '未命名网页' ? title : null;
    const shortUrl = projectUrl?.replace('https://', '') ?? '';

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-sm flex flex-col items-center gap-4">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                    <span className="material-symbols-outlined text-3xl">close</span>
                </button>

                {/* ── Poster Canvas (captured by html2canvas) ── */}
                <div
                    ref={posterRef}
                    style={{
                        width: '360px',
                        background: 'linear-gradient(135deg, #1e1a41 0%, #0d0a27 60%, #1a0d32 100%)',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                        fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
                    }}
                >
                    {/* Decorative glows */}
                    <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(224,142,254,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(144,148,250,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

                    {/* Header branding */}
                    <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 2 }}>
                        <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #e08efe, #9094fa)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>M</span>
                        </div>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: '14px', letterSpacing: '0.05em' }}>MoodSpace</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '0.1em' }}>moodspace.xyz</div>
                        </div>
                        {templateTitle && (
                            <div style={{ marginLeft: 'auto', background: 'rgba(224,142,254,0.15)', border: '1px solid rgba(224,142,254,0.3)', borderRadius: '20px', padding: '3px 10px', color: '#e08efe', fontSize: '10px', fontWeight: '600', letterSpacing: '0.05em', flexShrink: 0 }}>
                                {templateTitle}
                            </div>
                        )}
                    </div>

                    {/* Preview panel — prioritize static preview.jpg, fallback to srcdoc iframe */}
                    <div style={{ margin: '0 16px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', height: '185px', background: 'linear-gradient(135deg, rgba(224,142,254,0.08), rgba(144,148,250,0.05))', position: 'relative' }}>
                        {templateName && !imageFailed ? (
                            /* Static high-fidelity preview image (Captureable by html2canvas) */
                            <img
                                src={`https://www.moodspace.xyz/assets/${templateName}/preview.jpg`}
                                alt="Preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={() => setImageFailed(true)}
                                crossOrigin="anonymous"
                            />
                        ) : srcdoc ? (
                            /* srcdoc iframe fallback — bypasses X-Frame-Options entirely */
                            <iframe
                                srcDoc={srcdoc}
                                style={{ width: '1280px', height: '720px', transformOrigin: 'top left', transform: 'scale(0.25625)', border: 'none', pointerEvents: 'none' }}
                                title="项目预览"
                                sandbox="allow-scripts"
                            />
                        ) : (
                            /* Fallback: stylised gradient illustration */
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}>
                                <div style={{ fontSize: '48px', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' }}>🌸</div>
                                {displayTitle && (
                                    <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: '16px', fontWeight: '800', textAlign: 'center', lineHeight: 1.3, marginTop: '4px' }}>{displayTitle}</div>
                                )}
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', letterSpacing: '0.08em', textAlign: 'center' }}>{templateTitle}</div>
                            </div>
                        )}
                        {/* LIVE badge */}
                        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '20px', padding: '4px 10px', color: '#4ade80', fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', backdropFilter: 'blur(4px)', zIndex: 2 }}>LIVE</div>
                    </div>

                    {/* Title + URL */}
                    <div style={{ padding: '16px 24px 12px', position: 'relative', zIndex: 2 }}>
                        {displayTitle && (
                            <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: '17px', marginBottom: '4px', letterSpacing: '-0.01em', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {displayTitle}
                            </div>
                        )}
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', letterSpacing: '0.02em', fontWeight: '500' }}>
                            {shortUrl}
                        </div>
                    </div>

                    {/* QR code + CTA */}
                    <div style={{ margin: '0 16px 20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 2 }}>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR" style={{ width: '72px', height: '72px', borderRadius: '10px', background: 'white', padding: '4px', flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: '72px', height: '72px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1 }}>
                            <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>扫码立即查看</div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', lineHeight: '1.5' }}>长按图片保存，分享给ta ❤️</div>
                        </div>
                        <div style={{ fontSize: '28px', opacity: 0.6 }}>💝</div>
                    </div>

                    {/* Footer gradient bar */}
                    <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #e08efe, #9094fa, transparent)' }} />
                </div>

                {/* Download button (outside posterRef — not captured) */}
                <button
                    onClick={handleDownload}
                    disabled={generating}
                    className="w-full max-w-[360px] py-4 rounded-2xl font-bold text-white tracking-widest uppercase text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #e08efe, #9094fa)', boxShadow: '0 8px 32px rgba(224,142,254,0.4)' }}
                >
                    {generating ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-lg">download</span>
                            保存海报到相册
                        </>
                    )}
                </button>
                <p className="text-white/30 text-xs text-center">长按海报或点击按钮保存图片</p>
            </div>
        </div>
    );
}
