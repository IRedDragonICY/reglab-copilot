import { useEffect, useState, useRef } from 'react';

export interface ResizableSidebarOpts {
  initial?: number;
  min?: number;
  max?: number;
}

/**
 * Drag-to-resize for a right-anchored sidebar.
 *
 * The hook owns the width state, the drag-active flag, and the
 * `mousemove`/`mouseup` window listeners. It also manipulates
 * `document.body.style.cursor` and `userSelect` while dragging so the
 * cursor stays a `col-resize` arrow even after the pointer leaves the
 * handle. All side effects are torn down on unmount.
 *
 * Width state defaults: 400px, clamped to [320, 800]. Override per call.
 */
export function useResizableSidebar(opts: ResizableSidebarOpts = {}): {
  width: number;
  isDragging: boolean;
  dragHandleProps: { onMouseDown: (e: React.MouseEvent) => void };
} {
  const { initial = 400, min = 320, max = 800 } = opts;

  const [width, setWidth] = useState(initial);
  const [isDragging, setIsDragging] = useState(false);

  // Refs so the global listeners always see fresh bounds without re-binding.
  const minRef = useRef(min);
  const maxRef = useRef(max);
  minRef.current = min;
  maxRef.current = max;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > minRef.current && newWidth < maxRef.current) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return {
    width,
    isDragging,
    dragHandleProps: { onMouseDown },
  };
}
