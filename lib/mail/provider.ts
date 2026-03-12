import 'server-only';

import nodemailer from 'nodemailer';

import { APP_NAME } from '@/lib/env';
import { SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_SECURE, SMTP_USER, hasSmtpConfiguration } from '@/lib/server/mail-env';

type SendStudentVerificationEmailInput = {
  to: string;
  name: string;
  studentNo: string;
  verificationUrl: string;
};

let transporter: nodemailer.Transporter | null = null;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getTransporter() {
  if (!hasSmtpConfiguration) {
    throw new Error('SMTP environment variables are incomplete.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendStudentVerificationEmail(input: SendStudentVerificationEmailInput) {
  const activeTransporter = getTransporter();
  const from = SMTP_FROM || `${APP_NAME} <${SMTP_USER}>`;
  const displayName = input.name.trim() || '同学';
  const safeDisplayName = escapeHtml(displayName);
  const safeStudentNo = escapeHtml(input.studentNo);
  const safeVerificationUrl = escapeHtml(input.verificationUrl);

  await activeTransporter.sendMail({
    from,
    to: input.to,
    subject: `请确认你的校园邮箱 · ${APP_NAME}`,
    text: [
      `${displayName}，你好：`,
      '',
      `你正在为 ${APP_NAME} 注册账号，学号为 ${input.studentNo}。`,
      '请点击下面的链接确认校园邮箱：',
      input.verificationUrl,
      '',
      '如果这不是你的操作，请忽略这封邮件。',
    ].join('\n'),
    html: `
      <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.8; color: #222;">
        <p>${safeDisplayName}，你好：</p>
        <p>你正在为 <strong>${APP_NAME}</strong> 注册账号，学号为 <strong>${safeStudentNo}</strong>。</p>
        <p>请点击下面的链接确认校园邮箱：</p>
        <p><a href="${safeVerificationUrl}">${safeVerificationUrl}</a></p>
        <p>如果这不是你的操作，请忽略这封邮件。</p>
      </div>
    `,
  });
}
