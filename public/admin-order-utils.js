export function normalizePaymentMode(value) {
  return value === 'live' || value === 'sandbox' ? value : 'unknown';
}

export function isTestOrder(order) {
  const domain = String(order.email || '').trim().toLowerCase().split('@').pop();
  return order.internalTest === true || order.paymentMode === 'sandbox' ||
    /(^|\.)example\.(com|net|org)$/.test(domain);
}

export function customerOrderStats(orders) {
  const customers = orders.filter(order => !isTestOrder(order));
  return {
    total: customers.filter(order => order.status !== 'ENQUIRY').length,
    enquiries: customers.filter(order => order.status === 'ENQUIRY' && order.fulfillmentStatus !== 'CANCELLED').length,
    paid: customers.filter(order => order.status === 'PAID' && order.paymentMode === 'live').length,
    waiting: customers.filter(order => order.status !== 'PAID' && order.status !== 'ENQUIRY' && order.fulfillmentStatus !== 'CANCELLED').length,
    active: customers.filter(order => order.status === 'PAID' && order.paymentMode === 'live' &&
      ['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(order.fulfillmentStatus)).length,
    delivered: customers.filter(order => order.fulfillmentStatus === 'DELIVERED').length,
    tests: orders.length - customers.length,
    unverifiedPaid: customers.filter(order => order.status === 'PAID' && order.paymentMode !== 'live').length
  };
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
