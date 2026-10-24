import React, { useRef, useState } from 'react';
import TopologyNode from './TopologyNode';

export default function TopologyCanvas({
  nodes,
  links,
  tierBanners = [],
  selectedNodeId,
  onSelectNode,
  layoutMode,
  viewport,
  setViewport,
  canvasWidth = 1800,
  canvasHeight = 1000,
  searchTerm = '',
  containerRef
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const cleanSearch = searchTerm.trim().toLowerCase();

  // Pointer drag handlers with HTML5 Pointer Capture
  const handlePointerDown = (e) => {
    // If clicked on a node, button, or input, do not drag canvas
    if (e.target.closest('.topology-node') || e.target.closest('button') || e.target.closest('input')) return;
    if (e.button !== 0) return; // Left click only

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: viewport.x,
      initialY: viewport.y
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setViewport((prev) => ({
      ...prev,
      x: Math.round(dragStartRef.current.initialX + dx),
      y: Math.round(dragStartRef.current.initialY + dy)
    }));
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsDragging(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute inset-0 w-full h-full overflow-hidden select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(16, 185, 129, 0.1) 1.2px, transparent 1.2px), radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '28px 28px, 14px 14px'
      }}
    >
      {/* Transformable Canvas Surface - transition: none guarantees ZERO lag and ZERO drift */}
      <div
        className="absolute origin-top-left"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          transition: 'none'
        }}
      >
        {/* Tier Section Banners (Grouped Mode) */}
        {tierBanners.map((tier, idx) => (
          <div
            key={`tier-banner-${idx}`}
            className="absolute left-8 right-8 flex items-center gap-3 pointer-events-none select-none"
            style={{ top: `${tier.y}px` }}
          >
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/95 border border-slate-800 text-xs font-bold text-slate-300 backdrop-blur-md shadow-md">
              <span>{tier.icon}</span>
              <span>{tier.label}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-emerald-400 font-mono">
                {tier.count}
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-800/80 via-slate-800/40 to-transparent" />
          </div>
        ))}

        {/* SVG Links Layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        >
          <defs>
            <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {links.map((link, idx) => {
            const sx = link.source.x;
            const sy = link.source.y;
            const tx = link.target.x;
            const ty = link.target.y;

            let pathD = '';
            if (layoutMode === 'radial') {
              pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
            } else {
              const dy = ty - sy;
              const ctrlY1 = sy + dy * 0.45;
              const ctrlY2 = ty - dy * 0.45;
              pathD = `M ${sx} ${sy} C ${sx} ${ctrlY1}, ${tx} ${ctrlY2}, ${tx} ${ty}`;
            }

            const isDown = link.status === 'DOWN';
            const isWarn = link.status === 'WARNING';
            const strokeColor = isDown ? '#f43f5e' : isWarn ? '#f59e0b' : '#10b981';

            const isSelectedLink =
              selectedNodeId &&
              (String(link.target.id) === String(selectedNodeId) ||
                String(link.source.id) === String(selectedNodeId));

            return (
              <g key={`topo-link-${idx}`}>
                {/* Connecting Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelectedLink ? '#34d399' : strokeColor}
                  strokeWidth={isSelectedLink ? 3.0 : isDown ? 1.2 : 1.8}
                  strokeDasharray={isDown ? '5 5' : 'none'}
                  opacity={isSelectedLink ? 0.9 : isDown ? 0.25 : 0.35}
                />

                {/* Laser Data Pulse for active links */}
                {!isDown && (
                  <circle
                    r={isSelectedLink ? 4.5 : 3}
                    fill={isSelectedLink ? '#6ee7b7' : strokeColor}
                    filter="url(#laserGlow)"
                  >
                    <animateMotion
                      path={pathD}
                      dur={isSelectedLink ? '1.2s' : link.latency > 50 ? '3.5s' : '2.0s'}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        >
          {nodes.map((node) => {
            let isDimmed = false;
            if (cleanSearch) {
              const matchName = String(node.name || '').toLowerCase().includes(cleanSearch);
              const matchIp = String(node.ip || '').toLowerCase().includes(cleanSearch);
              const matchType = String(node.type || '').toLowerCase().includes(cleanSearch);
              isDimmed = !matchName && !matchIp && !matchType;
            }

            return (
              <TopologyNode
                key={node.id}
                node={node}
                isSelected={String(selectedNodeId) === String(node.id)}
                isDimmed={isDimmed}
                onClick={() => onSelectNode(node.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
