import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clampReaderWidth,
  MOBILE_READER_SNAPS,
  nearestMobileReaderSnap,
  parseReaderWidth,
  READER_WIDTH,
  readerWidthBounds,
} from "./ui-state";

const READER_WIDTH_STORAGE_KEY = "rhizome:reader-width";

interface Props {
  children?: ReactNode;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface DragState {
  pointerId: number;
  mobile: boolean;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  mobileExtent: number;
  lastWidth: number;
  lastHeight: number;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function readWidth(): number {
  try {
    return parseReaderWidth(
      window.localStorage.getItem(READER_WIDTH_STORAGE_KEY),
      window.innerWidth,
    );
  } catch {
    return clampReaderWidth(READER_WIDTH.default, window.innerWidth);
  }
}

function saveWidth(width: number): void {
  try {
    window.localStorage.setItem(READER_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Resizing remains available when storage is blocked.
  }
}

export function ReaderPane({ children, open, onClose, onOpen }: Props) {
  const compact = useMediaQuery("(max-width: 760px)");
  const [width, setWidth] = useState(readWidth);
  const [mobileHeight, setMobileHeight] = useState<number>(65);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<DragState | undefined>(undefined);
  const pointerListeners = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const onResize = () => setWidth((current) => clampReaderWidth(current, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(
    () => () => {
      pointerListeners.current?.abort();
      drag.current = undefined;
      document.body.classList.remove("is-resizing-reader");
    },
    [],
  );

  const moveResize = (event: globalThis.PointerEvent) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.mobile) {
      const next = Math.max(
        MOBILE_READER_SNAPS[0],
        Math.min(
          MOBILE_READER_SNAPS[MOBILE_READER_SNAPS.length - 1],
          active.startHeight + ((active.startY - event.clientY) / active.mobileExtent) * 100,
        ),
      );
      active.lastHeight = next;
      setMobileHeight(next);
    } else {
      const next = clampReaderWidth(
        active.startWidth + active.startX - event.clientX,
        window.innerWidth,
      );
      active.lastWidth = next;
      setWidth(next);
    }
  };

  const finishResize = (event: globalThis.PointerEvent) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.mobile) setMobileHeight(nearestMobileReaderSnap(active.lastHeight));
    else saveWidth(active.lastWidth);
    pointerListeners.current?.abort();
    pointerListeners.current = undefined;
    drag.current = undefined;
    setResizing(false);
    document.body.classList.remove("is-resizing-reader");
  };

  const beginResize = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    if (!open) onOpen();
    pointerListeners.current?.abort();
    drag.current = {
      pointerId: event.pointerId,
      mobile: compact,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: open ? width : READER_WIDTH.minimum,
      startHeight: mobileHeight,
      mobileExtent:
        event.currentTarget.closest<HTMLElement>(".workspace")?.clientHeight ?? window.innerHeight,
      lastWidth: open ? width : READER_WIDTH.minimum,
      lastHeight: mobileHeight,
    };
    setResizing(true);
    document.body.classList.add("is-resizing-reader");

    const listeners = new AbortController();
    pointerListeners.current = listeners;
    window.addEventListener("pointermove", moveResize, { signal: listeners.signal });
    window.addEventListener("pointerup", finishResize, { signal: listeners.signal });
    window.addEventListener("pointercancel", finishResize, { signal: listeners.signal });
  };

  const resizeByKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (open) onClose();
      else onOpen();
      return;
    }
    if (compact) {
      const currentIndex = MOBILE_READER_SNAPS.reduce(
        (best, value, index) =>
          Math.abs(value - mobileHeight) < Math.abs(MOBILE_READER_SNAPS[best] - mobileHeight)
            ? index
            : best,
        0,
      );
      let nextIndex = currentIndex;
      if (event.key === "ArrowUp") {
        nextIndex = Math.min(MOBILE_READER_SNAPS.length - 1, currentIndex + 1);
      } else if (event.key === "ArrowDown") nextIndex = Math.max(0, currentIndex - 1);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = MOBILE_READER_SNAPS.length - 1;
      else return;
      event.preventDefault();
      if (!open) onOpen();
      setMobileHeight(MOBILE_READER_SNAPS[nextIndex]);
      return;
    }

    const bounds = readerWidthBounds(window.innerWidth);
    const step = event.shiftKey ? 48 : 16;
    let next = width;
    if (event.key === "ArrowLeft") next = width + step;
    else if (event.key === "ArrowRight") next = width - step;
    else if (event.key === "Home") next = bounds.minimum;
    else if (event.key === "End") next = bounds.maximum;
    else return;
    event.preventDefault();
    if (!open) onOpen();
    next = clampReaderWidth(next, window.innerWidth);
    setWidth(next);
    saveWidth(next);
  };

  const resetSize = () => {
    if (!open) onOpen();
    if (compact) setMobileHeight(65);
    else {
      const next = clampReaderWidth(READER_WIDTH.default, window.innerWidth);
      setWidth(next);
      saveWidth(next);
    }
  };

  const bounds = readerWidthBounds(window.innerWidth);
  const valueNow = open ? (compact ? Math.round(mobileHeight) : width) : 0;
  const style = {
    "--reader-width": `${open ? width : 0}px`,
    "--reader-sheet-height": `${open ? mobileHeight : 0}%`,
  } as CSSProperties;

  return (
    <section
      className={`reader-pane ${open ? "is-open" : "is-closed"} ${resizing ? "is-resizing" : ""}`}
      id="reader-pane"
      style={style}
    >
      <hr
        aria-controls="reader-pane"
        aria-label="Resize reader"
        aria-orientation={compact ? "horizontal" : "vertical"}
        aria-valuemax={compact ? 92 : bounds.maximum}
        aria-valuemin={0}
        aria-valuenow={valueNow}
        className="reader-resizer"
        onDoubleClick={resetSize}
        onKeyDown={resizeByKeyboard}
        onPointerDown={beginResize}
        tabIndex={0}
      />
      {open && children}
    </section>
  );
}
