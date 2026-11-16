// The catalogue of designs and formats, and turning a choice into a saved file.
import { invite, fontsReady, jpeg, pdfOf } from './core.js';
import { letterpress } from './designs/letterpress.js';
import { lanterns } from './designs/lanterns.js';
import { meadow } from './designs/meadow.js';

export const DESIGNS = [letterpress, lanterns, meadow];

export const FORMATS = [
  { id: 'story', name: 'Status', note: 'WhatsApp status and stories', w: 1080, h: 1920 },
  { id: 'portrait', name: 'Portrait', note: 'Chats and feeds', w: 1080, h: 1350 },
  { id: 'square', name: 'Square', note: 'Anywhere', w: 1080, h: 1080 },
  { id: 'pdf', name: 'A4 PDF', note: 'A cover and a page per event', w: 1240, h: 1754, pdf: true },
];

export const pagesOf = (format) => (format.pdf ? ['cover', ...invite.events.map((_, i) => i)] : ['all']);

export async function renderPage(design, format, page) {
  await fontsReady();
  const c = document.createElement('canvas');
  c.width = format.w;
  c.height = format.h;
  const g = c.getContext('2d');
  await design.draw(g, { w: format.w, h: format.h, invite, page });
  return c;
}

export function fileName(design, format) {
  const { first, second } = invite.couple;
  return `${first}-${second}-${design.id}-${format.id}.${format.pdf ? 'pdf' : 'jpg'}`.toLowerCase();
}

// Renders every page of a choice into one File: a JPEG, or a PDF of all pages.
export async function exportFile(design, format, canvases) {
  const pages = canvases ?? await Promise.all(pagesOf(format).map((p) => renderPage(design, format, p)));
  const name = fileName(design, format);
  if (!format.pdf) return new File([await jpeg(pages[0])], name, { type: 'image/jpeg' });
  const { first, second } = invite.couple;
  const blobs = await Promise.all(pages.map(async (c) => ({ blob: await jpeg(c), width: c.width, height: c.height })));
  return new File([await pdfOf(blobs, `${first} and ${second}: invitation`)], name, { type: 'application/pdf' });
}
