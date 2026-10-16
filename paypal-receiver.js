// Read only: inspect PayPal's payee for an existing locally recorded order.
// Neither the customer (payer) nor an order's payment status identifies the seller.
export async function inspectPayPalReceiver({ mode, listOrders, readOrder }) {
  const records = (await listOrders())
    .filter(order => /^[a-z0-9]{10,32}$/i.test(order.paypalOrderId || ''))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, 5);

  for (const record of records) {
    let details;
    try {
      details = await readOrder(record.paypalOrderId);
    } catch (error) {
      // Sandbox records and records from a previous merchant may not be readable
      // with the current credentials. Never retry authentication or API outages.
      if (error.status === 403 || error.status === 404) continue;
      throw error;
    }
    if (details.id !== record.paypalOrderId || !Array.isArray(details.purchase_units) || details.purchase_units.length !== 1) continue;
    const unit = details.purchase_units[0];
    if (unit.reference_id !== record.id && unit.custom_id !== record.id) continue;
    const payee = unit.payee;
    const email = typeof payee?.email_address === 'string' ? payee.email_address.trim().slice(0, 254) : '';
    const merchantId = typeof payee?.merchant_id === 'string' ? payee.merchant_id.trim().slice(0, 32) : '';
    if (!email && !merchantId) continue;
    return {
      verified: true,
      mode,
      email,
      merchantId,
      checkedAt: new Date().toISOString(),
      source: 'existing_order'
    };
  }
  return { verified: false, mode, reason: 'NO_READABLE_ORDER', checkedAt: new Date().toISOString() };
}
