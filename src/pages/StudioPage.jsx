import { useEffect } from "react";
import { startStudio } from "../legacy/studio-app.js";

export default function StudioPage({ hidden = false }) {
  useEffect(() => {
    if (hidden) return undefined;
    startStudio().catch((err) => {
      const note = document.createElement("p");
      note.style.cssText = "color:#e66767;padding:12px";
      note.textContent = `Lỗi khởi động: ${err.message}`;
      document.querySelector(".studio-main")?.prepend(note);
    });
    return undefined;
  }, [hidden]);

  return (
    <div className="studio-main" hidden={hidden || undefined}>
      <header className="topbar">
        <span className="muted">Studio</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="muted" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        <div id="project-title" className="project-title">Dự án mới</div>
        <span id="q-chip" className="qchip hidden" />
        <span className="qchip market" id="market-chip" title="Ngôn ngữ video · chọn ở bước Kịch bản">VI</span>
        <span className="spacer" />
        <span id="busy-chip" className="busy hidden" />
        <button id="undo-btn" className="icon-btn bordered" title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
        </button>
        <a id="review-link" className="ghost-btn hidden" href="#/review">Gửi duyệt</a>
        <div className="export-wrap">
          <button id="export-btn" className="export-btn" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            Xuất
          </button>
          <div id="export-menu" className="export-menu hidden" />
        </div>
      </header>

      <nav className="mpanes" aria-label="Khung chỉnh">
        <button type="button" data-mpane="lib" aria-pressed="true">Dựng video</button>
        <button type="button" data-mpane="insp" aria-pressed="false">Cảnh đang chọn</button>
      </nav>
      <main id="tab-studio" className="editor">
        <section className="pane library">
          <nav id="lib-tabs" className="lib-tabs" />
          <div id="lib-body" className="lib-body" />
        </section>
        <section className="pane player-pane">
          <div className="player-stage">
            <div className="player-wrap">
              <video id="player" playsInline preload="auto" />
              <div id="render-overlay" className="overlay hidden" />
              <div id="empty-state" className="overlay"><span>Chọn kịch bản, tạo voice ở tab <b>Giọng</b>, chọn sản phẩm rồi bấm <b>Dựng video</b></span></div>
            </div>
          </div>
          <div className="player-bar">
            <span id="timecode" className="mono">00:00.0 / 00:00.0</span>
            <button id="play-btn" className="icon-btn play" title="Phát / dừng (Space)" aria-label="Phát">▶</button>
            <div className="bar-right">
              <span id="render-meta" className="muted" />
              <button id="fullscreen-btn" className="icon-btn" title="Toàn màn hình" aria-label="Toàn màn hình">⛶</button>
            </div>
          </div>
        </section>
        <section className="pane inspector">
          <nav id="insp-tabs" className="insp-tabs" />
          <div id="inspector" className="insp-body"><p className="muted pad">Chọn một cảnh trên timeline để chỉnh.</p></div>
        </section>
        <section className="pane timeline-pane">
          <div className="tl-toolbar">
            <div className="legend">
              <span><i className="sw real" />Sản phẩm</span>
              <span><i className="sw huyk" />HuyK</span>
              <span><i className="sw outro" />Outro</span>
              <span><i className="sw upload" />Tải lên</span>
              <span><i className="sw gen" />AI</span>
              <span><i className="sw missing" />Thiếu</span>
            </div>
            <span className="tool-sep" />
            <div className="tl-tools" role="group" aria-label="Công cụ timeline">
              <button id="tl-split" className="small-btn" title="Tách shot đang chọn làm 2 (Ctrl+B)">✂ Tách</button>
              <button id="tl-delete" className="small-btn" title="Xoá shot đang chọn (Delete)">🗑 Xoá</button>
              <span className="tl-tip-text">Kéo shot để đổi chỗ · kéo mép phải để chỉnh độ dài · thả file từ máy lên shot để thay</span>
            </div>
            <span className="spacer" />
            <label className="outro-pick">Outro <select id="outro-select" disabled><option>—</option></select></label>
            <span className="tool-sep" />
            <label className="zoom"><span className="sr">Thu phóng</span>− <input id="tl-zoom" type="range" min="1" max="4" step="0.25" defaultValue="1" /> +</label>
          </div>
          <div id="timeline" className="timeline" />
        </section>
      </main>
    </div>
  );
}
