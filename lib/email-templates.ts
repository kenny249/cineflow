// ─── CineFlow Email Templates ─────────────────────────────────────────────────
// Clean, black-background HTML emails for client notifications.

function base(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#d4a853;text-transform:uppercase;">CineFlow</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#111111;border:1px solid #222222;border-radius:12px;padding:36px 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#444444;">
                You're receiving this because your production team shared a project portal with you.<br/>
                If you have questions, reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:24px;background:#d4a853;color:#000000;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;border-radius:8px;padding:12px 28px;">${label}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f0f0f0;letter-spacing:-0.02em;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 0;font-size:14px;line-height:1.6;color:#888888;">${text}</p>`;
}

function divider(): string {
  return `<div style="height:1px;background:#222222;margin:24px 0;"></div>`;
}

function meta(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;color:#555555;">${label}</td>
    <td style="padding:6px 0;font-size:12px;color:#cccccc;font-weight:500;">${value}</td>
  </tr>`;
}

// ─── Template: Portal is live ──────────────────────────────────────────────────
export function emailPortalLive({
  clientName,
  projectTitle,
  portalUrl,
  studioName = "Your production team",
}: {
  clientName: string;
  projectTitle: string;
  portalUrl: string;
  studioName?: string;
}): { subject: string; html: string } {
  const subject = `Your project portal is ready — ${projectTitle}`;
  const body = `
    ${h1("Your project portal is ready.")}
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#888888;">Hi ${clientName}, ${studioName} has set up a private portal so you can follow the production of <strong style="color:#f0f0f0;">${projectTitle}</strong> from start to finish.</p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#666666;">From your portal you can:</p>
    <ul style="margin:12px 0 0;padding-left:20px;font-size:13px;color:#888888;line-height:1.8;">
      <li>Follow the production timeline as it progresses</li>
      <li>Watch and review cuts when they're ready</li>
      <li>Leave frame-accurate notes directly on the video</li>
      <li>Download your final deliverables</li>
    </ul>
    ${btn("View your project portal", portalUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#444444;">Save this link — it's your permanent access to this project.</p>
  `;
  return { subject, html: base(subject, body) };
}

// ─── Template: Revision ready for review ─────────────────────────────────────
export function emailRevisionReady({
  clientName,
  projectTitle,
  revisionTitle,
  versionNumber,
  portalUrl,
}: {
  clientName: string;
  projectTitle: string;
  revisionTitle: string;
  versionNumber: number;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = `${projectTitle} — Your cut is ready to review`;
  const body = `
    ${h1("Your cut is ready to watch.")}
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#888888;">Hi ${clientName}, a new revision of <strong style="color:#f0f0f0;">${projectTitle}</strong> is ready for your feedback.</p>
    ${divider()}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${meta("Project", projectTitle)}
      ${meta("Revision", revisionTitle)}
      ${meta("Version", `v${versionNumber}`)}
    </table>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#666666;">Watch the cut and leave frame-accurate notes directly on the timeline. Your team will be notified instantly.</p>
    ${btn("Watch & review", portalUrl)}
  `;
  return { subject, html: base(subject, body) };
}

// ─── Template: Feedback received ─────────────────────────────────────────────
export function emailFeedbackReceived({
  clientName,
  projectTitle,
  portalUrl,
}: {
  clientName: string;
  projectTitle: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = `${projectTitle} — Your notes have been received`;
  const body = `
    ${h1("Your notes have been received.")}
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#888888;">Hi ${clientName}, your revision feedback on <strong style="color:#f0f0f0;">${projectTitle}</strong> has been received. Your team is reviewing your notes and will get to work.</p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#666666;">You'll hear back once the next cut is ready for review.</p>
    ${btn("View your portal", portalUrl)}
  `;
  return { subject, html: base(subject, body) };
}

// ─── Template: Cut approved ───────────────────────────────────────────────────
export function emailApproved({
  clientName,
  projectTitle,
  revisionTitle,
  portalUrl,
}: {
  clientName: string;
  projectTitle: string;
  revisionTitle: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = `${projectTitle} — Cut approved ✓`;
  const body = `
    ${h1("Cut approved — moving to final.")}
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#888888;">Hi ${clientName}, you've approved <strong style="color:#f0f0f0;">${revisionTitle}</strong> for <strong style="color:#f0f0f0;">${projectTitle}</strong>. Your team will now prepare the final delivery.</p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#666666;">You'll receive a final email with your download link once everything is ready.</p>
    ${btn("View your portal", portalUrl)}
  `;
  return { subject, html: base(subject, body) };
}

// ─── Template: Final delivery ─────────────────────────────────────────────────
export function emailFinalDelivery({
  clientName,
  projectTitle,
  portalUrl,
}: {
  clientName: string;
  projectTitle: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = `${projectTitle} — Your final cut is ready`;
  const body = `
    ${h1("Your final cut is ready.")}
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#888888;">Hi ${clientName}, <strong style="color:#f0f0f0;">${projectTitle}</strong> has been delivered. Your final file is available to download from your portal.</p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#666666;">Log into your portal to download your deliverables. Your access link will remain active.</p>
    ${btn("Download your files", portalUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#444444;">Thank you for trusting us with your project.</p>
  `;
  return { subject, html: base(subject, body) };
}
