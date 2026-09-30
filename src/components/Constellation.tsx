import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { Graph, GraphNode } from '../lib/analyze';
import { layoutConstellation, type LayoutPoint } from '../lib/layout';
import { pluralize, shortAddress } from '../lib/format';
import type { WalletInfo } from '../lib/types';

interface ConstellationProps {
  wallet: WalletInfo;
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onShowEverything: () => void;
  /** Total nodes before filters, to tell an empty filter result from empty data. */
  totalNodes: number;
}

interface View {
  k: number;
  x: number;
  y: number;
}

const LABEL_LIMIT = 8;
const PADDING = 48;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;
const HOME_VIEW: View = { k: 1, x: 0, y: 0 };

export function nodeName(node: GraphNode): string {
  return node.label ?? shortAddress(node.display);
}

export function Constellation({ wallet, graph, selectedId, onSelect, onShowEverything, totalNodes }: ConstellationProps) {
  const layout = useMemo(
    () => layoutConstellation(graph.nodes.map((n) => ({ id: n.id, weight: n.total }))),
    [graph.nodes],
  );
  const maxEdge = useMemo(() => graph.edges.reduce((m, e) => Math.max(m, e.count), 0), [graph.edges]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const viewBox = useMemo(() => {
    const { minX, minY, maxX, maxY } = layout.bounds;
    const width = Math.max(maxX - minX + PADDING * 2, 320);
    const height = Math.max(maxY - minY + PADDING * 2, 240);
    return { x: minX - PADDING, y: minY - PADDING, width, height };
  }, [layout.bounds]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>(HOME_VIEW);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    pinchDist: null as number | null,
    downNode: null as string | null,
  });

  // A new data set resets the camera.
  useEffect(() => {
    setView(HOME_VIEW);
  }, [wallet.address]);

  // Track the rendered stage size so labels and strokes can stay a constant
  // size on screen regardless of how far the map is zoomed out to fit.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      setStage((current) =>
        current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height },
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  /** Map units per rendered CSS pixel at zoom level 1. */
  const unitsPerPixel = useMemo(() => {
    if (stage.width === 0 || stage.height === 0) return 1;
    return Math.max(viewBox.width / stage.width, viewBox.height / stage.height);
  }, [stage, viewBox]);
  /** Map units per screen pixel at the current zoom: multiply screen sizes by this. */
  const px = unitsPerPixel / view.k;

  const zoomBy = useCallback(
    (factor: number, pivot?: { x: number; y: number }) => {
      setView((current) => {
        const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
        const ratio = k / current.k;
        const point = pivot ?? { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
        return { k, x: point.x - (point.x - current.x) * ratio, y: point.y - (point.y - current.y) * ratio };
      });
    },
    [viewBox],
  );

  const toViewBoxPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const renderedWidth = viewBox.width / unitsPerPixel;
      const renderedHeight = viewBox.height / unitsPerPixel;
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;
      return {
        x: viewBox.x + (clientX - rect.left - offsetX) * unitsPerPixel,
        y: viewBox.y + (clientY - rect.top - offsetY) * unitsPerPixel,
      };
    },
    [unitsPerPixel, viewBox],
  );

  // Wheel zoom needs a non-passive listener so the page does not scroll too.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomBy(factor, toViewBoxPoint(event.clientX, event.clientY));
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [toViewBoxPoint, zoomBy]);

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // Pointer capture means later events target the svg, so remember which
    // star (if any) the press started on and resolve the tap on release.
    const star = (event.target as Element).closest?.('[data-node-id]');
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      pinchDist: null,
      downNode: star?.getAttribute('data-node-id') ?? null,
    };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDist = Math.hypot(b!.x - a!.x, b!.y - a!.y);
    }
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(b!.x - a!.x, b!.y - a!.y);
      const startDist = gesture.current.pinchDist ?? dist;
      if (startDist > 0 && Math.abs(dist - startDist) > 2) {
        zoomBy(dist / startDist, toViewBoxPoint((a!.x + b!.x) / 2, (a!.y + b!.y) / 2));
        gesture.current.pinchDist = dist;
      }
      gesture.current.moved = true;
      return;
    }

    if (Math.hypot(current.x - gesture.current.startX, current.y - gesture.current.startY) > 4) {
      gesture.current.moved = true;
    }
    const dx = (current.x - previous.x) * unitsPerPixel;
    const dy = (current.y - previous.y) * unitsPerPixel;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointers.current.size === 0 && !gesture.current.moved && event.type === 'pointerup') {
      const tapped = gesture.current.downNode;
      if (tapped) onSelect(selectedId === tapped ? null : tapped);
      else onSelect(null);
    }
    if (pointers.current.size < 2) gesture.current.pinchDist = null;
    gesture.current.downNode = null;
  };

  const handleNodeKey = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(selectedId === id ? null : id);
    } else if (event.key === 'Escape' && selectedId) {
      event.preventDefault();
      onSelect(null);
    }
  };

  const activeId = hoveredId ?? focusedId ?? selectedId;
  const centerName = wallet.ensName ?? wallet.label ?? shortAddress(wallet.display);
  const labelled = new Set(graph.nodes.slice(0, LABEL_LIMIT).map((n) => n.id));
  const isEmpty = graph.nodes.length === 0;
  const labelSize = 12 * px;

  return (
    <div className="constellation">
      <div className="constellation__toolbar">
        <p className="constellation__hint">Drag to pan, scroll or pinch to zoom, select a star for details.</p>
        <div className="constellation__controls" role="group" aria-label="Map zoom">
          <button type="button" className="icon-button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </button>
          <button type="button" className="icon-button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" className="button button--ghost button--small" onClick={() => setView(HOME_VIEW)}>
            Reset view
          </button>
        </div>
      </div>

      <div className="constellation__stage">
        <svg
          ref={svgRef}
          className="constellation__svg"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label={`Constellation of ${pluralize(graph.nodes.length, 'counterparty', 'counterparties')} around ${centerName}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <radialGradient id="center-glow">
              <stop offset="0%" stopColor="var(--color-center-star)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--color-center-star)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <g className="edges" aria-hidden="true">
              {graph.edges.map((edge) => {
                const point = layout.points.get(edge.target);
                if (!point) return null;
                const node = nodeById.get(edge.target);
                const twoWay = node ? node.incoming > 0 && node.outgoing > 0 : false;
                const width = (1 + 2.5 * Math.sqrt(edge.count / Math.max(1, maxEdge))) * px;
                const dim = activeId !== null && activeId !== edge.target;
                const emphasised = activeId === edge.target;
                return (
                  <path
                    key={edge.id}
                    className={`edge edge--${edge.direction} ${edge.isContract ? 'edge--contract' : ''} ${dim ? 'edge--dim' : ''} ${emphasised ? 'edge--active' : ''}`}
                    d={edgePath(point, edge.direction, twoWay, 14 * px)}
                    strokeWidth={width}
                    strokeDasharray={edge.isContract ? `${5 * px} ${4 * px}` : undefined}
                  />
                );
              })}
            </g>

            <g className="center-star">
              <circle r={layout.centerRadius * 3} fill="url(#center-glow)" />
              <circle r={layout.centerRadius} className="center-star__body" strokeWidth={2 * px} />
              <text
                y={-(layout.centerRadius + 8 * px)}
                textAnchor="middle"
                className="star-label star-label--center"
                fontSize={13 * px}
                strokeWidth={3 * px}
              >
                {centerName}
              </text>
            </g>

            <g className="stars">
              {graph.nodes.map((node) => {
                const point = layout.points.get(node.id);
                if (!point) return null;
                const name = nodeName(node);
                const selected = selectedId === node.id;
                const showLabel = labelled.has(node.id) || selected || activeId === node.id;
                const dim = activeId !== null && activeId !== node.id;
                // Stars keep their relative size but never shrink below 4 screen pixels.
                const radius = Math.max(point.r, 4 * px);
                return (
                  <g
                    key={node.id}
                    className={`star ${node.isContract ? 'star--contract' : 'star--wallet'} ${selected ? 'star--selected' : ''} ${dim ? 'star--dim' : ''}`}
                    transform={`translate(${point.x} ${point.y})`}
                    role="button"
                    tabIndex={0}
                    data-node-id={node.id}
                    aria-label={`${name}, ${node.isContract ? 'contract' : 'wallet'}, ${pluralize(node.total, 'interaction')}`}
                    aria-pressed={selected}
                    onKeyDown={(event) => handleNodeKey(event, node.id)}
                    onPointerEnter={() => setHoveredId(node.id)}
                    onPointerLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                    onFocus={() => setFocusedId(node.id)}
                    onBlur={() => setFocusedId((current) => (current === node.id ? null : current))}
                  >
                    <title>{`${name} · ${node.isContract ? 'contract' : 'wallet'} · ${pluralize(node.total, 'interaction')}`}</title>
                    {/* Generous invisible hit area (at least 44 screen px wide) so small stars stay tappable. */}
                    <circle r={Math.max(radius + 8 * px, 22 * px)} className="star__hit" />
                    {selected || focusedId === node.id ? (
                      <circle r={radius + 5 * px} className="star__ring" strokeWidth={2 * px} />
                    ) : null}
                    {node.isContract ? (
                      <path d={diamondPath(radius)} className="star__body" strokeWidth={1.5 * px} />
                    ) : (
                      <circle r={radius} className="star__body" strokeWidth={1.5 * px} />
                    )}
                    {showLabel ? (
                      <text
                        y={radius + 14 * px}
                        textAnchor="middle"
                        className="star-label"
                        fontSize={labelSize}
                        strokeWidth={3 * px}
                      >
                        {name}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {isEmpty ? (
          <div className="constellation__empty">
            {totalNodes === 0 ? (
              <>
                <p className="constellation__empty-title">No stars to show</p>
                <p>This address has no recent transactions or token transfers on Ethereum mainnet.</p>
              </>
            ) : (
              <>
                <p className="constellation__empty-title">No stars match these filters</p>
                <p>Turn a filter back on to bring the activity back into view.</p>
                <button type="button" className="button button--ghost button--small" onClick={onShowEverything}>
                  Show everything
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <ul className="legend" aria-label="Map legend">
        <li className="legend__item">
          <span className="legend__line legend__line--outgoing" aria-hidden="true" />
          Outgoing
        </li>
        <li className="legend__item">
          <span className="legend__line legend__line--incoming" aria-hidden="true" />
          Incoming
        </li>
        <li className="legend__item">
          <span className="legend__line legend__line--contract" aria-hidden="true" />
          Contract interaction (dashed)
        </li>
        <li className="legend__item">
          <span className="legend__dot legend__dot--wallet" aria-hidden="true" />
          Wallet
        </li>
        <li className="legend__item">
          <span className="legend__dot legend__dot--contract" aria-hidden="true" />
          Contract
        </li>
        <li className="legend__item legend__item--note">Larger stars interact more often.</li>
      </ul>
    </div>
  );
}

function edgePath(point: LayoutPoint, direction: 'in' | 'out', twoWay: boolean, bow: number): string {
  if (!twoWay) return `M0 0L${point.x} ${point.y}`;
  // Bow the two directions apart so both lines stay visible.
  const length = Math.hypot(point.x, point.y) || 1;
  const nx = -point.y / length;
  const ny = point.x / length;
  const offset = direction === 'out' ? bow : -bow;
  const cx = point.x / 2 + nx * offset;
  const cy = point.y / 2 + ny * offset;
  return `M0 0Q${round(cx)} ${round(cy)} ${point.x} ${point.y}`;
}

function diamondPath(r: number): string {
  const s = r * 1.15;
  return `M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
