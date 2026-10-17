import crypto from 'node:crypto';

const retryWindowMs = 23 * 60 * 60 * 1000;
const maxAttempts = 8;

export function notificationJobs(order, messages) {
  return messages.map(({ kind, payload }) => ({
    id: crypto.createHash('sha256').update(`${order.id}:${order.captureId}:${kind}`).digest('hex'),
    orderId: order.id,
    kind,
    payload
  }));
}

// A claimed job has a two-minute lease. Each provider request times out after 15 seconds.
// Retries keep both the exact payload and provider key within Resend's 24-hour window.
export async function processEmailOutbox({ store, deliver, now = () => Date.now() }) {
  let processed = 0;
  while (processed < 10) {
    const job = await store.claimNotification();
    if (!job) break;
    processed++;
    if (now() - new Date(job.firstAttemptAt).getTime() >= retryWindowMs || job.attempts > maxAttempts) {
      await store.failNotification(job, { permanent: true, delaySeconds: 0 });
      continue;
    }
    try {
      const messageId = await deliver(job.payload, `paid-order/${job.id}`);
      if (!messageId) throw Error('Email provider did not accept the notification');
      await store.completeNotification(job, messageId);
    } catch {
      await store.failNotification(job, {
        permanent: job.attempts >= maxAttempts,
        delaySeconds: Math.min(3600, 60 * 2 ** (job.attempts - 1))
      });
    }
  }
  return processed;
}
