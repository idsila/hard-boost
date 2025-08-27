const axios = require('axios');

const inv = {
  update_id: 61148358,
  update_type: 'invoice_paid',
  request_date: '2025-08-23T09:36:31.714Z',
  payload: {
    invoice_id: 32245580,
    hash: 'IVlnTEHUS9gr',
    currency_type: 'crypto',
    asset: 'USDT',
    amount: '1.5',
    paid_asset: 'USDT',
    paid_amount: '1.5',
    fee_asset: 'USDT',
    fee_amount: '0.045',
    fee: '0.045',
    fee_in_usd: '0.04497996',
    pay_url: 'https://t.me/CryptoBot?start=IVlnTEHUS9gr',
    bot_invoice_url: 'https://t.me/CryptoBot?start=IVlnTEHUS9gr',
    mini_app_invoice_url: 'https://t.me/CryptoBot/app?startapp=invoice-IVlnTEHUS9gr&mode=compact',
    web_app_invoice_url: 'https://app.cr.bot/invoices/IVlnTEHUS9gr',
    description: 'Оплата за тестовый товар #123',
    status: 'paid',
    created_at: '2025-08-23T09:28:15.220Z',
    allow_comments: true,
    allow_anonymous: true,
    paid_usd_rate: '0.99955478',
    usd_rate: '0.99955478',
    paid_at: '2025-08-23T09:36:31.568Z',
    paid_anonymously: false
  }
}

const inv_2 = {
  update_id: 61148358,
  update_type: 'invoice_paid',
  request_date: '2025-08-23T09:36:31.714Z',
  payload: {
    invoice_id: 32248540,
    hash: 'IVlnTEHUS9gr',
    currency_type: 'crypto',
    asset: 'USDT',
    amount: '100',
    paid_asset: 'USDT',
    paid_amount: '1.5',
    fee_asset: 'USDT',
    fee_amount: '0.045',
    fee: '0.045',
    fee_in_usd: '0.04497996',
    pay_url: 'https://t.me/CryptoBot?start=IVlnTEHUS9gr',
    bot_invoice_url: 'https://t.me/CryptoBot?start=IVlnTEHUS9gr',
    mini_app_invoice_url: 'https://t.me/CryptoBot/app?startapp=invoice-IVlnTEHUS9gr&mode=compact',
    web_app_invoice_url: 'https://app.cr.bot/invoices/IVlnTEHUS9gr',
    description: 'Оплата за тестовый товар #123',
    status: 'paid',
    created_at: '2025-08-23T09:28:15.220Z',
    allow_comments: true,
    allow_anonymous: true,
    paid_usd_rate: '0.99955478',
    usd_rate: '0.99955478',
    paid_at: '2025-08-23T09:36:31.568Z',
    paid_anonymously: false
  }
}





const inv_3 = {
  update_id: 61158494,
  update_type: 'invoice_paid',
  request_date: '2025-08-23T10:58:12.902Z',
  payload: {
    invoice_id: 32249668,
    hash: 'IV0MxlFpYRK5',
    currency_type: 'fiat',
    fiat: 'RUB',
    amount: '100',
    paid_asset: 'USDT',
    paid_amount: '1.24192786',
    paid_fiat_rate: '80.52098473',
    accepted_assets: [ 'USDT' ],
    fee_asset: 'USDT',
    fee_amount: '0.0372578358',
    fee: '0.0372578358',
    fee_in_usd: '0.03724397',
    pay_url: 'https://t.me/CryptoBot?start=IV0MxlFpYRK5',
    bot_invoice_url: 'https://t.me/CryptoBot?start=IV0MxlFpYRK5',
    mini_app_invoice_url: 'https://t.me/CryptoBot/app?startapp=invoice-IV0MxlFpYRK5&mode=compact',
    web_app_invoice_url: 'https://app.cr.bot/invoices/IV0MxlFpYRK5',
    description: 'Пополнение баланса на 100₽',
    status: 'paid',
    created_at: '2025-08-23T10:50:22.228Z',
    allow_comments: true,
    allow_anonymous: true,
    paid_usd_rate: '0.99962799',
    usd_rate: '0.99962799',
    paid_at: '2025-08-23T10:58:12.810Z',
    paid_anonymously: false
  }
}


// axios.post('https://480b515b-0c75-494d-89a2-b88565776bc3-00-23dxbkc3tpwcp.picard.replit.dev:3000/pay', 
//   inv_3
//   , {  headers: { 'Content-Type':'application/json' } }).then(res => {
//   console.log(res)
// })



axios.post('http://localhost:3000/send-user', 
  {
    id: 7502494374,
    msg: `✨ <b>Что я умею:</b>\n<blockquote>• Генерировать QR-коды
• Нейросеть для генерации текста
• Переводить текст

• Реферальная система
• Проверка подписок
• Принятие заявок через бота
• Связь с админом

• Оплата звездами
• Оплато криптовалютой
• Оплата ЮMoney

• Покупа звезд
• Покупка накрутки

• Создание розагрышей
• Скачивание видео с тиктока
</blockquote>\n📱 <b>Мини приложения:</b>\n<blockquote>• Копия кликера Notcoin
• Копия фейк казино
• Интерфейс для ии
</blockquote>`
  }
  , {  headers: { 'Content-Type':'application/json' } }).then(res => {
  console.log(res)
})