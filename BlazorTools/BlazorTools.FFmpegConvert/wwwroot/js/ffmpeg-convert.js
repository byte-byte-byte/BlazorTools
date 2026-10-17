// ffmpeg.wasm 0.12.10 轻封装（替代 0.11 版）。
// 0.12 架构变化：ffmpeg 执行移入独立 Worker（class worker），即使单线程 core 也不阻塞主线程，
// log/progress 经 postMessage 实时送达 —— 进度条可实时刷新，转换期间页面不再冻结。
//
// 进度实现说明（重要）：core 0.12.10 的 progress 事件在第二次 exec 时 C 端状态残留
// （实测 time= 直接是上轮残值、progress 恒 ~1.0，ffmpeg.reset() 只清 ret/timeout 不清进度），
// 因此本封装不使用 core 的 progress 事件，改为在 log 事件里自行解析
// "  Duration:"（总时长）与 "size=/frame= ... time="（当前进度）实时计算比例，
// 对任意次数的转换均正确。
//
// 全部资源本地化于 _content/BlazorTools.FFmpegConvert/ffmpeg/：
//   ffmpeg.js        @ffmpeg/ffmpeg 0.12.10 UMD 主类（script 标签加载，挂 window.FFmpegWASM）
//   814.ffmpeg.js    class worker（module worker，内部动态 import core）
//   ffmpeg-core.js   @ffmpeg/core 0.12.10 ESM 版（export default createFFmpegCore）
//                    —— 注意必须用 esm 版：module worker 里 importScripts 不可用，
//                       814.ffmpeg.js 会走 await import(coreURL)，umd 版无 default 导出会失败
//   ffmpeg-core.wasm core 0.12.10（31.9 MB）
//
// 导出（签名与 0.11 版一致，razor 侧无感）：
//   load(dotnetRef)                         → 加载核心，成功返回 true
//   setFile(name, streamRef, type)          → 接收文件字节（DotNetStreamReference），缓存并返回预览 Blob URL
//   convert(argv, inName, outName, outType) → 写入 FS、执行、读出结果，返回输出 Blob URL
//   isLoaded()                              → 核心是否就绪

let ffmpeg = null;
let loadPromise = null;
let fileCache = null; // { name, bytes: Uint8Array }
let duration = 0;     // 当前输入时长（秒），自进度解析用，随每轮 Duration 行刷新

function assetURL(name) {
    return new URL('_content/BlazorTools.FFmpegConvert/ffmpeg/' + name, document.baseURI).href;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('脚本加载失败: ' + src));
        document.head.appendChild(s);
    });
}

function ts2sec(ts) {
    const [h, m, s] = ts.split(':');
    return (parseFloat(h) * 3600) + (parseFloat(m) * 60) + parseFloat(s);
}

export async function load(dotnetRef) {
    if (ffmpeg && ffmpeg.loaded) return true;
    if (!window.FFmpegWASM) {
        await loadScript(assetURL('ffmpeg.js'));
    }
    if (!ffmpeg) {
        const { FFmpeg } = window.FFmpegWASM;
        ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ type, message }) => {
            try { dotnetRef && dotnetRef.invokeMethodAsync('OnLog', type + ': ' + message); } catch { }
            // 自算进度（不依赖 core 的 progress 事件，规避其第二次 exec 残值 bug）
            try {
                if (typeof message !== 'string') return;
                if (message.indexOf('  Duration:') === 0 || /Duration: /.test(message)) {
                    const d = ts2sec(message.split(', ')[0].split(': ')[1]);
                    if (d > 0) duration = d;
                } else if (message.indexOf('size=') === 0 || message.indexOf('frame=') === 0) {
                    const m = message.match(/time=([\d:.]+)/);
                    if (m && duration > 0) {
                        const ratio = Math.min(1, Math.max(0, ts2sec(m[1]) / duration));
                        dotnetRef && dotnetRef.invokeMethodAsync('OnProgress', ratio);
                    }
                } else if (message.indexOf('video:') === 0 && duration > 0) {
                    dotnetRef && dotnetRef.invokeMethodAsync('OnProgress', 1);
                }
            } catch { }
        });
    }
    if (!loadPromise) {
        loadPromise = ffmpeg.load({
            coreURL: assetURL('ffmpeg-core.js'),
            wasmURL: assetURL('ffmpeg-core.wasm'),
            classWorkerURL: assetURL('814.ffmpeg.js')
        }).catch(e => { loadPromise = null; throw e; });
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
    if (!ffmpeg || !ffmpeg.loaded) throw new Error('FFmpeg 核心尚未加载');
    if (!fileCache) throw new Error('尚未选择文件');
    if (fileCache.name !== inName) throw new Error('文件缓存不匹配，请重新选择文件');
    duration = 0; // 新一轮转换，进度状态归零
    await ffmpeg.writeFile(fileCache.name, fileCache.bytes);
    // 0.12 的 exec 不再自动附加 -nostdin/-y（0.11 的 defaultArgs），需显式携带
    const code = await ffmpeg.exec(['-nostdin', '-y', ...argv]);
    if (code !== 0) throw new Error('ffmpeg 转换失败（退出码 ' + code + '）');
    const data = await ffmpeg.readFile(outName);
    try { await ffmpeg.deleteFile(outName); } catch { }
    return URL.createObjectURL(new Blob([data.buffer], { type: outType }));
}

export function isLoaded() {
    return !!(ffmpeg && ffmpeg.loaded);
}
