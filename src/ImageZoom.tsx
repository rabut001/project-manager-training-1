import { useEffect, useRef, useState } from "react";

export function ImageZoom({ src, no, onClose }: { src: string; no: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(2);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function changeScale(value: number) {
    setScale(value);
    pane.current?.scrollTo(0, 0);
  }
  return <dialog className="zoom-dialog" ref={dialog} onClose={onClose} aria-labelledby="zoom-title">
    <div className="zoom-toolbar">
      <strong id="zoom-title">問{no}</strong>
      <div className="zoom-scales" role="group" aria-label="表示倍率">
        {[1, 2, 3].map((value) => <button type="button" key={value} className={scale === value ? "selected" : undefined}
          aria-pressed={scale === value} onClick={() => changeScale(value)}>{value}倍</button>)}
      </div>
      <button type="button" onClick={() => dialog.current?.close()}>閉じる</button>
    </div>
    <div className="zoom-scroll" ref={pane}>
      <img src={src} alt={`問${no}の拡大画像`} style={{ width: `${scale * 100}%` }} />
    </div>
  </dialog>;
}
