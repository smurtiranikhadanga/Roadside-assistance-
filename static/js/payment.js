/* payment.js — Razorpay integration with demo fallback */

async function initiatePayment() {
  if (!currentRequestId) {
    showToast('No active request to pay for.', 'warning');
    return;
  }

  // Demo mode if no key configured
  if (!RZP_KEY) {
    simulateDemoPayment();
    return;
  }

  try {
    const res = await apiCall('/api/v1/payment/create-order', 'POST', { request_id: currentRequestId });
    if (!res.success) { showToast(res.error || 'Payment init failed', 'danger'); return; }

    const options = {
      key: RZP_KEY,
      amount: res.amount,
      currency: 'INR',
      name: 'RoadSide+',
      description: 'Roadside Assistance Payment',
      order_id: res.order_id,
      handler: async function (response) {
        const verRes = await apiCall('/api/v1/payment/verify', 'POST', {
          request_id: currentRequestId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });
        if (verRes.success) {
          showToast('✅ Payment successful!', 'success');
          document.getElementById('payment-pending-card')?.classList.add('hidden');
          loadPaymentHistory();
          document.getElementById('review-modal')?.classList.add('open');
        } else {
          showToast('Payment verification failed. Contact support.', 'danger');
        }
      },
      prefill: { name: USER_NAME },
      theme: { color: '#FF6B35' }
    };
    new Razorpay(options).open();
  } catch (e) {
    console.error(e);
    showToast('Payment service unavailable — using demo mode.', 'warning');
    simulateDemoPayment();
  }
}

function simulateDemoPayment() {
  // Simulated payment flow for demo/testing
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:2rem;max-width:380px;width:90%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.3)">
      <div style="font-size:3rem;margin-bottom:1rem">💳</div>
      <h3 style="font-size:1.3rem;font-weight:800;color:#1E3A5F;margin-bottom:.5rem">Demo Payment</h3>
      <p style="color:#5A6A7A;font-size:.9rem;margin-bottom:1.5rem">This is a simulated payment for testing. In production, Razorpay will handle real transactions.</p>
      <div style="background:#F0F4F8;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left">
        <div style="display:flex;justify-content:space-between;margin-bottom:.5rem"><span style="color:#5A6A7A">Service</span><strong>Roadside Assistance</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:.5rem"><span style="color:#5A6A7A">Amount</span><strong>₹599</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#5A6A7A">Status</span><span style="color:#00B894;font-weight:700">Demo Mode</span></div>
      </div>
      <button id="demo-pay-btn" style="width:100%;padding:.85rem;border-radius:12px;background:linear-gradient(135deg,#FF6B35,#E55A26);color:#fff;font-weight:700;font-size:1rem;border:none;cursor:pointer;font-family:inherit">
        ✅ Simulate Payment
      </button>
      <button onclick="this.closest('div[style]').remove()" style="width:100%;margin-top:.75rem;padding:.75rem;border-radius:12px;background:none;border:1.5px solid #E5EAF0;color:#5A6A7A;font-weight:600;cursor:pointer;font-family:inherit">
        Cancel
      </button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#demo-pay-btn').addEventListener('click', () => {
    overlay.remove();
    showToast('✅ Demo payment successful!', 'success');
    document.getElementById('payment-pending-card')?.classList.add('hidden');
    document.getElementById('review-modal')?.classList.add('open');
  });
}
