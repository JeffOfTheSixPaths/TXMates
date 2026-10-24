import { HangoutPlan, ItineraryItem, Friend } from '@/types';

/**
 * Helper to draw rounded rectangle across all canvas implementations
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export interface ExportPngOptions {
  groupName: string;
  items: ItineraryItem[];
  plan: HangoutPlan;
  friends: Friend[];
}

/**
 * Generates a high-resolution, beautifully branded PNG card of the locked Austin itinerary
 * and automatically triggers browser download.
 */
export function exportItineraryAsPng(options: ExportPngOptions): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  const { groupName, items, plan, friends } = options;

  const width = 1200;
  const headerHeight = 270;
  const metricsHeight = 110;
  const itemHeight = 180;
  const footerHeight = 120;
  const padding = 50;

  const totalHeight =
    headerHeight +
    metricsHeight +
    items.length * (itemHeight + 20) +
    footerHeight +
    padding;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 2, 2);
  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);

  // 1. Overall Background
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(0, 0, width, totalHeight);

  // 2. Header Container with Gradient
  const headerGrad = ctx.createLinearGradient(0, 0, width, headerHeight);
  headerGrad.addColorStop(0, '#0F3838');
  headerGrad.addColorStop(0.5, '#134E4A');
  headerGrad.addColorStop(1, '#0F172A');

  drawRoundRect(ctx, 40, 40, width - 80, headerHeight - 40, 24);
  ctx.fillStyle = headerGrad;
  ctx.fill();

  // Header Sub-badge
  ctx.fillStyle = 'rgba(20, 184, 166, 0.25)';
  drawRoundRect(ctx, 70, 70, 230, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#5EEAD4';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('★ TXMATES • AUSTIN, TEXAS', 85, 91);

  // Locked Status Badge in top right
  ctx.fillStyle = '#059669';
  drawRoundRect(ctx, width - 290, 70, 220, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('✓ LOCKED & CONFIRMED', width - 265, 91);

  // Hangout Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${groupName} Hangout Itinerary`, 70, 155);

  // Header Metadata
  ctx.fillStyle = '#CCFBF1';
  ctx.font = '500 16px system-ui, -apple-system, sans-serif';
  const timeSpan =
    items.length > 0
      ? `${items[0].timeSlot.split('-')[0].trim()} – ${items[items.length - 1].timeSlot.split('-')[1]?.trim() || ''}`
      : 'Flexible Afternoon';
  ctx.fillText(
    `${items.length} Curated Austin Stops • ${friends.length} Friends Attending • ${timeSpan}`,
    70,
    195
  );

  ctx.fillStyle = '#99F6E4';
  ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Crew: ${friends.map((f) => f.name).join(', ')}`,
    70,
    230
  );

  // 3. Metrics Bar
  const metricsY = headerHeight + 25;
  const metricWidth = (width - 80 - 40) / 3;

  // Box 1: Cost Per Person
  drawRoundRect(ctx, 40, metricsY, metricWidth, 90, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('EST. SPEND / PERSON', 65, metricsY + 32);

  ctx.fillStyle = '#0F766E';
  ctx.font = '900 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${plan.totalCostPerPerson.toFixed(0)}`, 65, metricsY + 68);

  // Box 2: Total Group Spend
  const m2X = 40 + metricWidth + 20;
  drawRoundRect(ctx, m2X, metricsY, metricWidth, 90, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOTAL GROUP SPEND', m2X + 25, metricsY + 32);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`$${plan.totalGroupCost.toFixed(0)}`, m2X + 25, metricsY + 68);

  // Box 3: Total Stops & Overlap
  const m3X = m2X + metricWidth + 20;
  drawRoundRect(ctx, m3X, metricsY, metricWidth, 90, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('CONSENSUS & ATTENDANCE', m3X + 25, metricsY + 32);

  ctx.fillStyle = '#047857';
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(`100% Free Overlap`, m3X + 25, metricsY + 68);

  // 4. Itinerary Stops
  let currentY = metricsY + 115;

  items.forEach((item, index) => {
    // Card background
    drawRoundRect(ctx, 40, currentY, width - 80, itemHeight, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Left accent bar
    ctx.fillStyle = '#0F766E';
    drawRoundRect(ctx, 40, currentY, 8, itemHeight, 4);
    ctx.fill();

    // Stop number circle
    ctx.fillStyle = '#134E4A';
    ctx.beginPath();
    ctx.arc(85, currentY + 45, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${index + 1}`, 85, currentY + 52);
    ctx.textAlign = 'left';

    // Time slot pill
    ctx.fillStyle = '#0F766E';
    drawRoundRect(ctx, 125, currentY + 28, 170, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`🕒 ${item.timeSlot}`, 138, currentY + 49);

    // Category pill
    ctx.fillStyle = '#F1F5F9';
    drawRoundRect(ctx, 305, currentY + 28, 140, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(item.activity.categoryLabel, 318, currentY + 49);

    // Cost & duration in top right
    ctx.fillStyle = '#0F766E';
    ctx.font = '900 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.activity.estimatedCostPerPerson}/person`, width - 75, currentY + 42);

    ctx.fillStyle = '#64748B';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${item.activity.durationMinutes} mins`, width - 75, currentY + 60);
    ctx.textAlign = 'left';

    // Venue Name
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(item.activity.name, 125, currentY + 92);

    // Location & Neighborhood
    ctx.fillStyle = '#64748B';
    ctx.font = '500 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `📍 ${item.activity.location} (${item.activity.neighborhood})`,
      125,
      currentY + 116
    );

    // Highlights tags
    const highlightText = `✓ ${item.activity.highlights.slice(0, 3).join('   ✓ ')}`;
    ctx.fillStyle = '#0369A1';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(highlightText, 125, currentY + 148);

    // Friend free count pill
    ctx.fillStyle = '#ECFDF5';
    drawRoundRect(ctx, width - 235, currentY + 130, 160, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(`✓ All ${item.availableFriendsCount} friends free`, width - 222, currentY + 147);

    currentY += itemHeight + 20;
  });

  // 5. Footer
  currentY += 10;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Generated by TXMates • Austin, Texas Social Planning • Locked on ${new Date().toLocaleDateString(
      'en-US',
      { month: 'long', day: 'numeric', year: 'numeric' }
    )}`,
    width / 2,
    currentY + 25
  );

  const dataUrl = canvas.toDataURL('image/png');

  // Trigger browser download
  const link = document.createElement('a');
  const safeFilename = `${groupName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Austin_Itinerary.png`;
  link.download = safeFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}
