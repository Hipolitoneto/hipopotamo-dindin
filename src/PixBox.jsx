import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PIX_KEY, pixPayload } from './pix';

const PAYLOAD = pixPayload();

function copyText(text) {
  const fallback = () => {
    try {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.left = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      const ok = document.execCommand('copy');
      helper.remove();
      return ok;
    } catch {
      return false;
    }
  };

  const modern = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    : Promise.resolve(false);

  return Promise.race([
    modern,
    new Promise((resolve) => window.setTimeout(() => resolve(false), 400)),
  ]).then((ok) => ok || fallback());
}

export function PixBox() {
  const [copied, setCopied] = useState(false);

  async function copyPix() {
    const copiedOk = await copyText(PIX_KEY);
    if (!copiedOk) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="pix-box">
      <p className="pix-kicker">Pagar no PIX</p>
      <div className="pix-qr">
        <QRCodeSVG value={PAYLOAD} size={168} bgColor="#ffffff" fgColor="#241910" level="M" />
      </div>
      <p className="pix-key">{PIX_KEY}</p>
      <button type="button" className="btn block" onClick={copyPix}>
        {copied ? 'PIX copiado' : 'Copiar PIX'}
      </button>
    </section>
  );
}
