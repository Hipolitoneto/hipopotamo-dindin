export const PIX_KEY = 'poponeto08@gmail.com';

function field(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload(key = PIX_KEY) {
  const account = field('26', field('00', 'br.gov.bcb.pix') + field('01', key));
  const body = [
    field('00', '01'),
    account,
    field('52', '0000'),
    field('53', '986'),
    field('58', 'BR'),
    field('59', 'HIPOPOTAMO DINDIN'),
    field('60', 'BRASIL'),
    field('62', field('05', '***')),
  ].join('');
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}
