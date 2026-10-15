const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  downloadMediaMessage 
} = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const express = require('express');

// سيرفر Express إجباري لـ Render و UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is online and running 24/7!');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

async function startBot() {
  // حفظ الجلسة حتى لا تطلب تسجيل الدخول في كل مرة
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // يظهر كود QR في السجلات (Logs)
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('تم قطع الاتصال، جاري إعادة المحاولة:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('تم الاتصال بالواتساب بنجاح!');
    }
  });

  // استلام الرسائل
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const isSticker = msg.message.stickerMessage;

    if (isSticker) {
      try {
        // 1. تنزيل الاستيكر المستلم
        const buffer = await downloadMediaMessage(msg, 'buffer', {});

        // 2. إعادة صناعة الاستيكر بحقوقك الخاصة
        const sticker = new Sticker(buffer, {
          pack: 'اسم البوت بتاعك',      // اسم الحزمة
          author: 'اسمك / حقوقك',     // اسم المؤلف
          type: StickerTypes.FULL,
          quality: 70,
        });

        const stickerBuffer = await sticker.toBuffer();

        // 3. إعادة إرسال الاستيكر
        await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
      } catch (err) {
        console.error('خطأ أثناء تحويل الاستيكر:', err);
      }
    }
  });
}

startBot();
