/* payment.js — Razorpay integration */

let pendingRequestId = null;

async function initiatePayment(requestId) {
  const rid = requestId || pendingRequestId;
  if (!rid) return showToast('No active request to pay', 'warning');

  const res = await api('/api/v1/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ request_id: rid })
  });

  if (!res.success) return showToast(res.message, 'danger');

  const { order_id, amount, currency, key_id } = res.data;

  const options = {
    key: key_id,
    amount,
    currency,
    name: 'RoadSide+',
    description: 'Roadside Assistance Service',
    order_id,
    handler: async function(response) {
      const verifyRes = await api('/api/v1/payments/verify', {
        method: 'POST',
        body: JSON.stringify(response)
      });
      if (verifyRes.success) {
        showToast('✅ Payment successful! Thank you.', 'success');
        setTimeout(() => openModal('review-modal'), 1000);
        loadPaymentHistory();
      } else {
        showToast('❌ Payment verification failed.', 'danger');
      }
    },
    prefill: { name: typeof USER_NAME !== 'undefined' ? USER_NAME : '' },
    theme: { color: '#1a73e8' },
    modal: { ondismiss: () => showToast('Payment cancelled.', 'warning') }
  };

  new Razorpay(options).open();
}

async function loadPaymentHistory() {
  const res = await api('/api/v1/requests/history');
  if (!res.success) return;

  const tbody = document.getElementById('payment-history-body');
  if (!tbody) return;

  tbody.innerHTML = res.data.filter(r => r.status === 'completed').map(r => `
    <tr>
      <td class="text-xs text-muted">${fmtDate(r.requested_at)}</td>
      <td>${SERVICE_LABELS[r.service_type] || r.service_type}</td>
      <td class="text-green font-bold">${fmtMoney(r.total_amount)}</td>
      <td class="text-muted">—</td>
      <td><span class="badge badge-green">Paid</span></td>
    </tr>`).join('') || '<tr><td colspan="5" class="text-muted">No payments yet</td></tr>';
}
