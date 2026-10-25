import type { ItineraryItem } from '@/types';

const WIDTH = 800;
const PAD = 48;
const COLORS = {
  pine: '#e7f0df',
  paper: '#f3eadb',
  ink: '#241c16',
  inkSoft: '#4a3f36',
  sun: '#f2c14e',
  tomato: '#c7382f',
  seam: '#c9d4c0',
};

export type PosterFriend = {
  name: string;
  avatarColor?: string;
};

export type ItineraryPosterInput = {
  groupName: string;
  dateLabel: string;
  location: string;
  items: ItineraryItem[];
  friends: PosterFriend[];
  totalPerPerson: number;
  totalGroup: number;
};

type Measure = (text: string, font: string) => number;

type Op =
  | { kind: 'fill'; color: string; x: number; y: number; w: number; h: number }
  | { kind: 'text'; color: string; font: string; text: string; x: number; y: number };

export function itineraryImageFilename(groupName: string): string {
  const slug = groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'hangout'}-itinerary.png`;
}

export function formatPosterDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Draws the itinerary to a canvas and starts a PNG download.
 * A canvas bitmap (instead of a foreignObject screenshot) stays reliable in Chrome and
 * Edge on Windows: the image is same-origin, so it is not blank or tainted, and the
 * file is saved from a blob URL in the same click that locked the plan.
 */
export function downloadItineraryPng(input: ItineraryPosterInput): void {
  if (typeof document === 'undefined') {
    throw new Error('Itinerary images download in the browser.');
  }
  const family = canvasFamily();
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('Canvas is not available in this browser.');
  const measure: Measure = (text, font) => {
    probe.font = font;
    return probe.measureText(text).width;
  };
  const poster = layoutPoster(input, family, measure);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * scale;
  canvas.height = poster.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';
  for (const op of poster.ops) {
    if (op.kind === 'fill') {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.x, op.y, op.w, op.h);
    } else {
      ctx.fillStyle = op.color;
      ctx.font = op.font;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  saveCanvasPng(canvas, itineraryImageFilename(input.groupName));
}

function canvasFamily(): string {
  const fromBody = getComputedStyle(document.body).fontFamily;
  if (fromBody && fromBody.trim()) return fromBody;
  return '"Familjen Grotesk", sans-serif';
}

function face(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

function wrapText(text: string, textFace: string, maxWidth: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = words[0] || '';
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (measure(next, textFace) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function layoutPoster(input: ItineraryPosterInput, family: string, measure: Measure): { ops: Op[]; height: number } {
  const ops: Op[] = [];
  const inner = WIDTH - PAD * 2;
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    ops.push({ kind: 'fill', color, x, y, w, h });
  };
  const text = (value: string, textFace: string, color: string, x: number, y: number) => {
    ops.push({ kind: 'text', color, font: textFace, text: value, x, y });
  };

  let y = 0;
  fill(COLORS.pine, 0, 0, WIDTH, 10);
  fill(COLORS.sun, 0, 0, WIDTH, 12);
  y = 36;

  const kicker = face(600, 14, family);
  text('TXMATES', kicker, COLORS.tomato, PAD, y);
  y += 28;

  const titleFace = face(600, 40, family);
  for (const line of wrapText(input.groupName || 'Hangout', titleFace, inner, measure)) {
    text(line, titleFace, COLORS.ink, PAD, y);
    y += 46;
  }
  y += 4;
  const meta = face(400, 18, family);
  text(`${input.dateLabel} · ${input.location}`, meta, COLORS.inkSoft, PAD, y);
  y += 32;

  const badgeFace = face(600, 14, family);
  const badge = 'Locked itinerary';
  const badgeWidth = Math.ceil(measure(badge, badgeFace)) + 20;
  fill(COLORS.ink, PAD, y, badgeWidth, 28);
  text(badge, badgeFace, COLORS.paper, PAD + 10, y + 6);
  y += 48;

  const timeFace = face(600, 16, family);
  const nameFace = face(600, 26, family);
  const bodyFace = face(400, 16, family);
  input.items.forEach((item, index) => {
    const nameLines = wrapText(item.activity.name, nameFace, inner - 20, measure);
    const blockHeight = 24 + nameLines.length * 32 + 22 + 22;
    fill(COLORS.sun, PAD, y, 4, blockHeight - 8);
    text(`${item.timeSlot}   ·   Stop ${index + 1}`, timeFace, COLORS.ink, PAD + 16, y);
    y += 24;
    for (const line of nameLines) {
      text(line, nameFace, COLORS.ink, PAD + 16, y);
      y += 32;
    }
    const place = [item.activity.neighborhood, item.activity.location].filter(Boolean).join(' · ');
    text(place || 'Austin', bodyFace, COLORS.inkSoft, PAD + 16, y);
    y += 22;
    const cost =
      item.activity.estimatedCostPerPerson === 0
        ? 'Free'
        : `$${item.activity.estimatedCostPerPerson} a person`;
    text(
      `${cost}   ·   ${item.activity.durationMinutes} min   ·   ${item.activity.categoryLabel}`,
      bodyFace,
      COLORS.ink,
      PAD + 16,
      y
    );
    y += 36;
  });

  y += 4;
  fill(COLORS.seam, PAD, y, inner, 1);
  y += 18;
  const totalFace = face(600, 18, family);
  text(`$${input.totalPerPerson.toFixed(0)} a person`, totalFace, COLORS.ink, PAD, y);
  text(`$${input.totalGroup.toFixed(0)} for the group`, totalFace, COLORS.ink, PAD + 280, y);
  y += 32;
  for (const line of wrapText(friendSentence(input.friends), meta, inner, measure)) {
    text(line, meta, COLORS.ink, PAD, y);
    y += 26;
  }
  y += 10;
  text(
    'Times include a 20 minute travel gap between stops. Prices are estimates.',
    face(400, 14, family),
    COLORS.inkSoft,
    PAD,
    y
  );
  y += 36;

  ops[0] = { kind: 'fill', color: COLORS.pine, x: 0, y: 0, w: WIDTH, h: y };
  return { ops, height: y };
}

function friendSentence(friends: PosterFriend[]): string {
  const names = friends.map((friend) => friend.name).filter(Boolean);
  if (names.length === 0) return 'No friends listed yet.';
  if (names.length === 1) return `With ${names[0]}.`;
  const last = names[names.length - 1];
  return `With ${names.slice(0, -1).join(', ')} and ${last}.`;
}

function saveCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const dataUrl = canvas.toDataURL('image/png');
  const encoded = dataUrl.split(',')[1] || '';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}
