import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

/** Default From address. Override per-event by passing `from` explicitly. */
const DEFAULT_FROM =
  process.env.RESEND_FROM_EMAIL || "Conference Day <noreply@conferenceday.app>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    /** Raw content as string or Buffer; Resend base64-encodes it for us. */
    content: string | Buffer;
  }>;
}

export async function sendEmail(opts: SendEmailOptions) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: opts.from || DEFAULT_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
  return data;
}
