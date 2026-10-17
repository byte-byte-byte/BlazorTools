// ffmpeg.wasm 轻封装 —— 替代 FFmpegBlazor（其内部绑定 API 在 .NET 8+ 被移除，无法在 net8/net10 下工作）。
// 通过 ES module 由 Blazor 按需 import；ffmpeg 核心运行时从本地 _content 静态资源加载（无需外网）。
//
// 导出：
//   load(dotnetRef)                 → 加载核心（@ffmpeg/ffmpeg 0.11.6 + core 0.11.0），成功返回 true
//   setFile(name, streamRef, type)  → 接收文件字节（DotNetStreamReference），缓存并返回预览 Blob URL
//   convert(argv, inName, outName, outType) → 写入 FS、执行、读出结果，返回输出 Blob URL
//   isLoaded()                      → 核心是否就绪

let ffmpeg = null;
let loadPromise = null;
let fileCache = null; // { name, bytes: Uint8Array }

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('脚本加载失败: ' + src));
        document.head.appendChild(s);
    });
}

export async function load(dotnetRef) {
    if (ffmpeg && ffmpeg.isLoaded()) return true;
    if (!window.FFmpeg) {
        // 本地静态资源：RCL wwwroot/ffmpeg/，发布后位于 _content/BlazorTools.FFmpegConvert/ 下
        // new URL(..., document.baseURI) 解析为绝对地址，避免 worker/相对路径解析错位
        await loadScript(new URL('_content/BlazorTools.FFmpegConvert/ffmpeg/ffmpeg.min.js', document.baseURI).href);
    }
    if (!ffmpeg) {
        ffmpeg = window.FFmpeg.createFFmpeg({
            log: false,
            corePath: new URL('_content/BlazorTools.FFmpegConvert/ffmpeg/ffmpeg-core.js', document.baseURI).href,
            logger: ({ type, message }) => {
                try { dotnetRef && dotnetRef.invokeMethodAsync('OnLog', type + ': ' + message); } catch { }
            },
            progress: (p) => {
                const ratio = Math.min(1, Math.max(0, p && typeof p.progress === 'number' ? p.progress : 0));
                try { dotnetRef && dotnetRef.invokeMethodAsync('OnProgress', ratio); } catch { }
            }
        });
    }
    if (!loadPromise) {
        loadPromise = ffmpeg.load().catch(e => { loadPromise = null; throw e; });
    }
    await loadPromise;
    return true;
}

export async function setFile(name, streamRef, type) {
    const buf = await streamRef.arrayBuffer();
    fileCache = { name, bytes: new Uint8Array(buf) };
    return URL.createObjectURL(new Blob([fileCache.bytes], { type: type || 'application/octet-stream' }));
}

export async function convert(argv, inName, outName, outType) {
    if (!ffmpeg || !ffmpeg.isLoaded()) throw new Error('FFmpeg 核心尚未加载');
    if (!fileCache) throw new Error('尚未选择文件');
    if (fileCache.name !== inName) throw new Error('文件缓存不匹配，请重新选择文件');
    ffmpeg.FS('writeFile', fileCache.name, fileCache.bytes);
    await ffmpeg.run(...argv);
    const data = ffmpeg.FS('readFile', outName);
    try { ffmpeg.FS('unlink', outName); } catch { }
    return URL.createObjectURL(new Blob([data.buffer], { type: outType }));
}

export function isLoaded() {
    return !!(ffmpeg && ffmpeg.isLoaded());
}
