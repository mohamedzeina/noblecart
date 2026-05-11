const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const STATUS_LABELS = {
  pending:          'Order Placed',
  confirmed:        'Order Confirmed',
  shipped:          'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  canceled:         'Canceled',
};

function orderRows(products) {
  return products.map((p) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${p.productData.title}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:center;">×${p.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;text-align:right;">$${(p.productData.price * p.quantity).toFixed(2)}</td>
    </tr>
  `).join('');
}

function baseTemplate({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#111111;padding:24px 32px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Noblecart_</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">You're receiving this email because you placed an order on Noblecart.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

exports.sendOrderConfirmation = (order, email) => {
  const total = order.products.reduce((sum, p) => sum + p.quantity * p.productData.price, 0);
  const shortId = '#' + order._id.toString().slice(-8).toUpperCase();

  const html = baseTemplate({
    title: 'Order Confirmed',
    preheader: `Your order ${shortId} has been placed successfully.`,
    body: `
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Thanks for your order! We've received it and will start processing it shortly.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#64748b;">Order ID</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b;">${shortId}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Product</th>
            <th style="text-align:center;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Qty</th>
            <th style="text-align:right;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Price</th>
          </tr>
        </thead>
        <tbody>${orderRows(order.products)}</tbody>
      </table>
      <div style="text-align:right;padding-top:12px;border-top:2px solid #1e293b;">
        <span style="font-size:18px;font-weight:700;color:#1e293b;">Total: $${total.toFixed(2)}</span>
      </div>
    `,
  });

  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `Order ${shortId} confirmed — Noblecart`,
    html,
  });
};

exports.sendStatusUpdate = (order, email) => {
  const shortId = '#' + order._id.toString().slice(-8).toUpperCase();
  const label = STATUS_LABELS[order.status] || order.status;
  const isCanceled = order.status === 'canceled';

  const html = baseTemplate({
    title: `Order ${label}`,
    preheader: `Your order ${shortId} status has been updated to ${label}.`,
    body: `
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">
        ${isCanceled
          ? `Your order ${shortId} has been canceled. If you have questions, please contact support.`
          : `Good news! Your order ${shortId} has been updated to <strong>${label}</strong>.`}
      </p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#64748b;">Current Status</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${isCanceled ? '#991b1b' : '#1e293b'};">${label}</p>
      </div>
    `,
  });

  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `Order ${shortId} — ${label} | Noblecart`,
    html,
  });
};

exports.sendWelcome = (email) => {
  const html = baseTemplate({
    title: 'Welcome to Noblecart',
    preheader: 'Your account has been created successfully.',
    body: `
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Your account is ready. Start browsing and add items to your cart whenever you're ready.</p>
      <a href="${process.env.APP_URL || 'http://localhost:3000'}"
         style="display:inline-block;background:#111111;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Start Shopping
      </a>
    `,
  });

  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Welcome to Noblecart',
    html,
  });
};

exports.sendPasswordReset = (email, token, protocol, host) => {
  const resetUrl = `${protocol}://${host}/reset/${token}`;

  const html = baseTemplate({
    title: 'Reset Your Password',
    preheader: 'A password reset was requested for your Noblecart account.',
    body: `
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#111111;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Reset Password
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    `,
  });

  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Reset your Noblecart password',
    html,
  });
};
