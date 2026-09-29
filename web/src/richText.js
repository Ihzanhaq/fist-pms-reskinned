import DOMPurify from 'dompurify';

export const PMS_BASE = 'https://pms.fistinnovations.com';

// Descriptions and comments are HTML written by other PMS users. Sanitize it,
// open links in a new tab, and point relative links at the PMS.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  for (const attr of ['href', 'src']) {
    const value = node.getAttribute?.(attr);
    if (value?.startsWith('/')) node.setAttribute(attr, PMS_BASE + value);
  }
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// The PMS editor embeds pasted images as <image-component>, which only the PMS can render.
const IMAGE_PLACEHOLDER = '<span class="rt-image">Image — open in PMS to view</span>';

export function sanitizeRichText(html) {
  const withPlaceholders = (html ?? '').replace(
    /<image-component\b[^>]*>(?:<\/image-component>)?/gi,
    IMAGE_PLACEHOLDER,
  );
  return DOMPurify.sanitize(withPlaceholders, { FORBID_TAGS: ['style', 'form', 'input'] });
}

export function isBlank(html) {
  const clean = sanitizeRichText(html);
  return !clean.replace(/<[^>]+>/g, '').trim() && !/<img/i.test(clean);
}
