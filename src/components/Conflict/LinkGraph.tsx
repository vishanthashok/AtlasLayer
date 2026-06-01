'use client';

import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const d3 = require('d3-force') as typeof import('d3-force');
import type { CountryRisk } from '../../lib/conflict/types';
import { scoreToColor } from './colors';
import styles from './LinkGraph.module.css';

interface Node {
  id: string;
  label: string;
  type: 'state' | 'non-state' | 'sanctioned';
  risk: number;
  iso?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: 'alliance' | 'conflict' | 'sanction' | 'proxy';
  strength: number;
}

interface Props {
  countries: CountryRisk[];
  onSelectCountry: (iso: string) => void;
}

const NODE_TYPE_COLORS: Record<Node['type'], string> = {
  state:       '#00d4ff',
  'non-state': '#ff8c00',
  sanctioned:  '#ff3b3b',
};

const LINK_TYPE_COLORS: Record<Link['type'], string> = {
  alliance:  'rgba(0, 212, 255, 0.35)',
  conflict:  'rgba(255, 59, 59, 0.40)',
  sanction:  'rgba(255, 140, 0, 0.35)',
  proxy:     'rgba(167, 139, 250, 0.35)',
};

function buildGraphData(countries: CountryRisk[]): { nodes: Node[]; links: Link[] } {
  const topRisk = [...countries].sort((a,b) => b.composite_score - a.composite_score).slice(0, 20);

  const nodes: Node[] = [
    ...topRisk.map(c => ({
      id: c.iso_a2,
      label: c.name,
      type: 'state' as const,
      risk: c.composite_score,
      iso: c.iso_a2,
    })),
    { id: 'hamas', label: 'Hamas', type: 'non-state' as const, risk: 0.90 },
    { id: 'isis', label: 'ISIS', type: 'non-state' as const, risk: 0.95 },
    { id: 'hezbollah', label: 'Hezbollah', type: 'non-state' as const, risk: 0.85 },
    { id: 'houthis', label: 'Houthis', type: 'non-state' as const, risk: 0.82 },
    { id: 'wagner', label: 'Wagner Group', type: 'sanctioned' as const, risk: 0.80 },
    { id: 'un', label: 'UN', type: 'state' as const, risk: 0.02 },
    { id: 'nato', label: 'NATO', type: 'state' as const, risk: 0.05 },
  ];

  const links = [
    { source: 'IL', target: 'hamas', type: 'conflict', strength: 0.9 },
    { source: 'IL', target: 'hezbollah', type: 'conflict', strength: 0.8 },
    { source: 'LB', target: 'hezbollah', type: 'proxy', strength: 0.7 },
    { source: 'IR', target: 'hamas', type: 'proxy', strength: 0.75 },
    { source: 'IR', target: 'houthis', type: 'proxy', strength: 0.8 },
    { source: 'IR', target: 'hezbollah', type: 'proxy', strength: 0.85 },
    { source: 'YE', target: 'houthis', type: 'conflict', strength: 0.9 },
    { source: 'SA', target: 'YE', type: 'conflict', strength: 0.7 },
    { source: 'SY', target: 'isis', type: 'conflict', strength: 0.85 },
    { source: 'IQ', target: 'isis', type: 'conflict', strength: 0.8 },
    { source: 'RU', target: 'UA', type: 'conflict', strength: 0.95 },
    { source: 'RU', target: 'wagner', type: 'proxy', strength: 0.9 },
    { source: 'wagner', target: 'ML', type: 'proxy', strength: 0.7 },
    { source: 'wagner', target: 'CF', type: 'proxy', strength: 0.65 },
    { source: 'UA', target: 'nato', type: 'alliance', strength: 0.7 },
    { source: 'un', target: 'SS', type: 'alliance', strength: 0.5 },
    { source: 'un', target: 'AF', type: 'alliance', strength: 0.3 },
    { source: 'KP', target: 'RU', type: 'alliance', strength: 0.6 },
    { source: 'KP', target: 'CN', type: 'alliance', strength: 0.7 },
    { source: 'PS', target: 'hamas', type: 'proxy', strength: 0.8 },
  ].filter(
    (l) => nodes.some((n) => n.id === l.source) && nodes.some((n) => n.id === l.target)
  ) as Link[];

  return { nodes, links };
}

export function LinkGraph({ countries, onSelectCountry }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; type: string; risk: number } | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || countries.length === 0) return;

    const { width, height } = svg.getBoundingClientRect();
    const { nodes, links } = buildGraphData(countries);

    // Clear previous
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const sim = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(d => 80 / (d as Link).strength)
        .strength(d => (d as Link).strength * 0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(22));

    const ns = 'http://www.w3.org/2000/svg';

    // Defs — arrowhead
    const defs = document.createElementNS(ns, 'defs');
    for (const [type, color] of Object.entries(LINK_TYPE_COLORS)) {
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', `arrow-${type}`);
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('refX', '16');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M0,0 L0,6 L6,3 z');
      path.setAttribute('fill', color.replace(/[\d.]+\)$/, '0.8)'));
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    svg.appendChild(defs);

    // Grid lines background
    const grid = document.createElementNS(ns, 'g');
    for (let x = 0; x < width; x += 40) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(x)); line.setAttribute('y1', '0');
      line.setAttribute('x2', String(x)); line.setAttribute('y2', String(height));
      line.setAttribute('stroke', 'rgba(0,212,255,0.03)'); line.setAttribute('stroke-width', '1');
      grid.appendChild(line);
    }
    for (let y = 0; y < height; y += 40) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', '0'); line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(width)); line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'rgba(0,212,255,0.03)'); line.setAttribute('stroke-width', '1');
      grid.appendChild(line);
    }
    svg.appendChild(grid);

    // Links
    const linkGroup = document.createElementNS(ns, 'g');
    const linkEls = links.map(l => {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('stroke', LINK_TYPE_COLORS[l.type]);
      line.setAttribute('stroke-width', String(l.strength * 1.5));
      line.setAttribute('marker-end', `url(#arrow-${l.type})`);
      linkGroup.appendChild(line);
      return line;
    });
    svg.appendChild(linkGroup);

    // Nodes
    const nodeGroup = document.createElementNS(ns, 'g');
    const nodeEls = nodes.map(node => {
      const g = document.createElementNS(ns, 'g');
      g.style.cursor = 'pointer';

      const r = node.type === 'state' ? 10 : 8;
      const color = node.type !== 'state' ? NODE_TYPE_COLORS[node.type] : scoreToColor(node.risk);

      // Outer ring
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('r', String(r + 3));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', color);
      ring.setAttribute('stroke-width', '0.5');
      ring.setAttribute('opacity', '0.3');
      g.appendChild(ring);

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('r', String(r));
      circle.setAttribute('fill', `${color}22`);
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '1.5');
      g.appendChild(circle);

      const text = document.createElementNS(ns, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', String(r + 12));
      text.setAttribute('font-size', '9');
      text.setAttribute('font-family', 'JetBrains Mono, monospace');
      text.setAttribute('fill', '#3a4a5e');
      text.setAttribute('pointer-events', 'none');
      text.textContent = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label;
      g.appendChild(text);

      g.addEventListener('mouseenter', (e) => {
        const rect = svg.getBoundingClientRect();
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          label: node.label,
          type: node.type,
          risk: node.risk,
        });
        circle.setAttribute('stroke-width', '2.5');
        ring.setAttribute('opacity', '0.7');
      });
      g.addEventListener('mouseleave', () => {
        setTooltip(null);
        circle.setAttribute('stroke-width', '1.5');
        ring.setAttribute('opacity', '0.3');
      });
      g.addEventListener('click', () => {
        setSelectedNode(node.id);
        if (node.iso) onSelectCountry(node.iso);
      });

      // Drag
      let dragging = false;
      g.addEventListener('mousedown', (e) => {
        dragging = true;
        node.fx = node.x;
        node.fy = node.y;
        e.stopPropagation();
      });
      svg.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = svg.getBoundingClientRect();
        node.fx = e.clientX - rect.left;
        node.fy = e.clientY - rect.top;
        sim.alpha(0.1).restart();
      });
      svg.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; node.fx = null; node.fy = null; }
      });

      nodeGroup.appendChild(g);
      return { g, circle };
    });
    svg.appendChild(nodeGroup);

    sim.on('tick', () => {
      links.forEach((l, i) => {
        const src = l.source as Node;
        const tgt = l.target as Node;
        linkEls[i].setAttribute('x1', String(src.x ?? 0));
        linkEls[i].setAttribute('y1', String(src.y ?? 0));
        linkEls[i].setAttribute('x2', String(tgt.x ?? 0));
        linkEls[i].setAttribute('y2', String(tgt.y ?? 0));
      });
      nodes.forEach((n, i) => {
        const tx = Math.max(15, Math.min(width - 15, n.x ?? width / 2));
        const ty = Math.max(15, Math.min(height - 15, n.y ?? height / 2));
        nodeEls[i].g.setAttribute('transform', `translate(${tx},${ty})`);
      });
    });

    return () => { sim.stop(); };
  }, [countries, onSelectCountry]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>ENTITY LINK ANALYSIS</span>
        <div className={styles.legend}>
          {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: color }} />
              {type}
            </span>
          ))}
          <span className={styles.legendSep} />
          {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: color.replace(/[\d.]+\)$/, '0.9)') }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.graphWrap}>
        <svg ref={svgRef} className={styles.svg} />
        {tooltip && (
          <div
            className={styles.tooltip}
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <div className={styles.tooltipName}>{tooltip.label}</div>
            <div className={styles.tooltipMeta}>
              <span style={{ color: NODE_TYPE_COLORS[tooltip.type as Node['type']] }}>{tooltip.type.toUpperCase()}</span>
              <span>RISK {(tooltip.risk * 100).toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
