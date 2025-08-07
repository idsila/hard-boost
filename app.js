require("dotenv").config();

const commands = require("./commands.js");
const dataBase = require("./dataBase.js");
const { Telegraf, session, Scenes } = require("telegraf");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { parse } = require("dotenv");
const app = express();

app.use(cors({ methods: ["GET", "POST"] }));
app.use(express.json());

const ADMIN_ID = 7502494374;

const bot = new Telegraf(process.env.TOKEN);
bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),
    defaultSession: () => ({ qr_code: false }),
    defaultSession: () => ({ ai_disabled: false }),
    defaultSession: () => ({ ai_answer: false }),
  })
);


function refCode(n = 6){
  const symbols = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890';
  let user_hash = '';
  for(let i = 0; i != n; i++){
    user_hash += symbols[Math.floor(Math.random()*symbols.length)];
  }
  return user_hash;
}




//bot.telegram.setMyCommands(commands);

// Система принятий и проверок в канал
bot.on("chat_join_requests", async (ctx) => {
  const {
    chat,
    from: { id, first_name, username, language_code },
    date,
  } = ctx.chatJoinRequest;
  dataBase.findOne({ username }).then(async (res) => {
    if (!res) {
      //Запись в базе данных создана
      dataBase.insertOne({
        id,
        first_name,
        username,
        language_code,
        ref_code: refCode(),
        referrals: 0,
        date: dateNow(),
        balance: 0,
        data_channel: { chat: chat, date: date, join: false },
      });
    } else if (res.data_channel === null || res.data_channel?.join) {
      //Пользователь уже есть в базе данных нужно обновить данные
      dataBase.updateOne(
        { username },
        { $set: { data_channel: { chat: chat, date: date, join: false } } }
      );
    }
  });

  await bot.telegram.sendPhoto(
    id,
    "https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg",
    {
      caption:
        " 🔐 <b>Чтобы попасть в наш тг канал подтвердите, что вы не робот нажав на кнопку ниже. </b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Я не робот 🚀", callback_data: "approve_join" }],
        ],
      },
    }
  );
});
bot.action("approve_join", async (ctx) => {
  const { id, first_name, username, language_code } =
    ctx.update.callback_query.from;
  dataBase.findOne({ username }).then(async (res) => {
    if (res) {
      if (!res.data_channel?.join || res.data_channel === null) {
        await dataBase.updateOne(
          { username },
          {
            $set: {
              data_channel: {
                chat: res.data_channel.chat,
                date: res.data_channel.date,
                join: true,
              },
            },
          }
        );
        await ctx.telegram.approveChatJoinRequest(res.data_channel.chat.id, id);
        await ctx.reply("🛠️ <b>Вы прошли проверку</b>", { parse_mode: "HTML" });
      } else {
        await ctx.reply("🏁 <b>Вы уже прошли проверку</b>", {
          parse_mode: "HTML",
        });
      }
    }
  });
});

//Сцены

const writeHelp = new Scenes.WizardScene(
  "write_help",
  (ctx) => {
    ctx.session.write_user = true;
    ctx.reply("<b>Напишите о вашей проблеме, можно прикрепить фото.</b>", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отменить", callback_data: "cancel_write_help" }],
        ],
      },
    });
    return ctx.wizard.next();
  },
  (ctx) => {
    const { id, username } = ctx.from;

    if (
      (ctx.callbackQuery?.data === "help" && ctx.session.write_user) ||
      ctx.callbackQuery?.data === "cancel_write_user_help" ||
      ctx.callbackQuery?.data === "cancel_write_help"
    ) {
      ctx.session.write_user = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    ctx.session.write_user = false;

    if (ctx.update.message.photo) {
      const photo = ctx.update.message.photo.pop();
      ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
        caption: `<b>Пользователь: @${username}</b> \n <blockquote>${
          ctx.update.message.caption ?? "Пусто"
        }</blockquote>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ответить", callback_data: `user_${id}_${username}` }],
          ],
        },
      });
    } else {
      ctx.telegram.sendMessage(
        ADMIN_ID,
        `<b>Пользователь: @${username}</b> > \n <blockquote>${ctx.message.text}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Ответить", callback_data: `user_${id}_${username}` }],
            ],
          },
        }
      );
    }
    ctx.reply(`✅ <b>Готово! Ваша заявка будет расмотренна.</b>`, {
      parse_mode: "HTML",
    });
    return ctx.scene.leave();
  }
);

const writeHelpAdmin = new Scenes.WizardScene(
  "write_help_admin",
  (ctx) => {
    const { id, username } = ctx.scene.state;
    ctx.session.write_admin = true;
    ctx.reply(`<b>Отвечаем > @${username}</b>`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отменить", callback_data: "cancel_write_user_help" }],
        ],
      },
    });
    return ctx.wizard.next();
  },
  (ctx) => {
    const { id, username } = ctx.scene.state;

    if (ctx.callbackQuery?.data.startsWith("user") && ctx.session.write_admin) {
      ctx.session.write_admin = false;
      return ctx.scene.leave();
    }

    if (
      ctx.callbackQuery?.data === "cancel_write_user_help" ||
      ctx.callbackQuery?.data === "cancel_write_help"
    ) {
      ctx.session.write_admin = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }
    ctx.session.write_admin = false;

    if (ctx.update.message.photo) {
      const photo = ctx.update.message.photo.pop();
      ctx.telegram.sendPhoto(id, photo.file_id, {
        caption: `🔔 <b>Ответ Администратора</b> >
        \n<blockquote>${ctx.update.message.caption ?? "Пусто"}</blockquote>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💻 Написать ещё", callback_data: `help` }],
          ],
        },
      });
    } else {
      ctx.telegram.sendMessage(
        id,
        `🔔 <b>Ответ Администратора</b> > \n <blockquote>${ctx.message.text}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💻 Написать ещё", callback_data: `help` }],
            ],
          },
        }
      );
    }
    ctx.reply(`✅ <b>Готово! Ответ отправлен.</b>`, { parse_mode: "HTML" });
    return ctx.scene.leave();
  }
);


const qrCode = new Scenes.WizardScene(
  "qr_code",
  (ctx) => {
    ctx.session.qr_code = true;
    ctx.reply(
      `<b>Отправьте текст или ссылку для генерации qr-кода @${ctx.from.username}</b>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Отменить", callback_data: "cancel_qr_code" }],
          ],
        },
      }
    );
    return ctx.wizard.next();
  },
  (ctx) => {
    ctx.deleteMessage();
    if (ctx.callbackQuery?.data === "cancel_qr_code") {
      ctx.session.qr_code = false;
      return ctx.scene.leave();
    }
    ctx.session.qr_code = false;

    const text = ctx.update.message.text;
    ctx.telegram.sendPhoto(ctx.from.id, `https://quickchart.io/qr?text=${text}&size=400`, {
      caption: `🔔 <b>QR-code сгенерирован</b> >
        \n<blockquote>${text}</blockquote>`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "💻 Сгнерировать ещё qr-code", callback_data: `qr_code` }]],
      },
    });

    return ctx.scene.leave();
  }
);


const stage = new Scenes.Stage([writeHelp, writeHelpAdmin, qrCode]);
bot.use(stage.middleware());

// Действия по нажатию inline кнопки
bot.action(/^user/i, async (ctx) => {
  if (!ctx.session.write_admin) {
    ctx.session.write_admin = false;
    const [, id, username] = ctx.match.input.split("_");
    ctx.scene.enter("write_help_admin", { id, username });
  }
});
bot.action("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});

bot.action("menu", async (ctx) => {
  await ctx.deleteMessage();
  ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "Выберите один из представленных товаров.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Подписчики", callback_data: `buy_subs` },
          { text: "👀 Просмотры", callback_data: `ai_menu` }
        ],
        [
          { text: "❤️ Реакций", callback_data: `check_sub` },
          { text: "☄️ Буст Канала", callback_data: `check_sub` }
        ],
        [
          { text: "⭐ Звезды", callback_data: `check_sub` }
        ],
        [
          { text: "💳 Пополнить баланс", callback_data: `pay_balance` }
        ],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});



bot.action("menu_back", async (ctx) => {
  if(ctx.session.ai_disabled){
    ctx.session.ai_disabled = false;
  }

  await ctx.editMessageMedia({
    type:"photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg",
    caption: "Выберите один из представленных товаров.",
    parse_mode: "HTML"
  },
  {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Подписчики", callback_data: `pay_balance` },
          { text: "👀 Просмотры", callback_data: `ai_menu` }
        ],
        [
          { text: "❤️ Реакций", callback_data: `check_sub` },
          { text: "⭐ Звезды", callback_data: `check_sub` }
        ],
        [
          { text: "💳 Пополнить баланс", callback_data: `pay_balance` }
        ],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});


bot.action("pay_balance", async (ctx) => {
  //await ctx.deleteMessage();


  await ctx.editMessageMedia({
    type: 'photo', 
    media: 'https://i.ibb.co/tTQ574gv/card-1002.jpg',
    caption: '<b>💸 Это все способы пополнения баланса.</b>',                     
    parse_mode: 'HTML'
  }, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💳 ЮMoney", callback_data: `pay_umoney` },
          { text: "🧠 Крипта", callback_data: `pay_crypto` },
        ],
        [{ text: "⭐ Звезды", callback_data: `pay_stars`, pay: true }],
        [{ text: "<< Назад", callback_data: `menu_back` }],
      ],
    }
  })
  // await ctx.replyWithPhoto(
  //   "https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg",
  //   {
  //     caption: "<b>💸 Это все способы пополнения баланса.</b>",
  //     parse_mode: "HTML",
  //     reply_markup: {
  //       inline_keyboard: [
  //         [
  //           { text: "💳 ЮMoney", callback_data: `pay_umoney` },
  //           { text: "🧠 Крипта", callback_data: `pay_crypto` },
  //         ],
  //         [{ text: "⭐ Звезды", callback_data: `pay_stars`, pay: true }],
  //         [{ text: "<< Назад", callback_data: `menu_back` }],
  //       ],
  //     },
  //   }
  // );

});

bot.action("pay_umoney", async (ctx) => {
  await ctx.editMessageMedia({
      type:"photo",
      media:"https://i.ibb.co/fbWNWJY/card-1003.jpg",
      caption: "<b>💸 Это пополнения баланса через ЮMoney.</b>",
      parse_mode: "HTML"
  },{
      reply_markup: {
        inline_keyboard: [
          [
            { text: "50₽", callback_data: `pay_umoney_50` },
            { text: "100₽", callback_data: `pay_umoney_100` },
            { text: "150₽", callback_data: `pay_umoney_150` },
          ],
          [
            { text: "200₽", callback_data: `pay_umoney_200` },
            { text: "250₽", callback_data: `pay_umoney_250` },
            { text: "300₽", callback_data: `pay_umoney_300` },
          ],
          [{ text: "<< Назад", callback_data: `pay_balance` }],
        ],
      },
    }
  );
});



bot.action("mini_app", async (ctx) => {
  await ctx.editMessageMedia({
      type:"photo",
      media:"https://i.ibb.co/sp8gcRrG/card-1006.jpg",
      caption: "<b>📱 Это мини приложения.</b>",
      parse_mode: "HTML"
  },{
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Кликер Notcoin", web_app: { url: "https://notcoin-ids.vercel.app/" } },
            { text: "Казино кейсы", web_app: { url: "https://notcoin-ids.vercel.app/" } },

          ],
          [
            { text: "Нейронка", web_app: { url: "https://notcoin-ids.vercel.app/" } },
          ],
          [{ text: "<< Назад", callback_data: "menu_back" }],
        ],
      },
    }
  );
});


bot.action("ai_menu", async (ctx) => {
  ctx.session.ai_disabled = true;
  await ctx.editMessageMedia({
      type:"photo",
      media:"https://i.ibb.co/gLF9nJHw/card-1007.jpg",
      caption: "<b>📱 Задавайте любые вопросы нейросети. Если хотите закончить перписку то введите команду /stop или нажмите кнопку ниже.</b>",
      parse_mode: "HTML"
  },{
      reply_markup: {
        inline_keyboard: [
          [{ text: "Завершить диалог", callback_data: "menu_back" }]
        ],
      },
    }
  );
});






bot.action("buy_subs", async (ctx) => {
  await ctx.deleteMessage();
  ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "Ниже представденны тарифы и их ценны за 1 тысяу.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
      
        [
          { text: "Подписчики ❌ Без гарантии = 4.8 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (~3 дня) = 36 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (~1-3 дня) = 15.1 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (~7 дня) = 50 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (30 дня) = 112 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (60 дня) = 170 ₽", callback_data: `buy_subs` },
        ],
        [
          { text: "Подписчики (90 дня) = 224 ₽", callback_data: `buy_subs` },
        ],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});






// Получение id канал для проверки подписки
bot.on('channel_post', async (ctx) => {
  const { chat: { id, title } }  = ctx.channelPost;
  console.log(id, title)
  dataBase.findOne({ id }).then(async (res) => {
    if(!res){
      console.log('Добавлен канал')
      dataBase.insertOne({ id, title });
    }
  });
});


bot.command('check', async (ctx) => {
  const { id } = ctx.from;
  const use = await bot.telegram.getChatMember(-1002760111651, id);
  if(use.status !== 'left'){
    ctx.reply('+');
  }
  else{
    ctx.reply('-');
  }
});



bot.action("qr_code", async (ctx) => {
  await ctx.deleteMessage();
  if (!ctx.session.qr_code) {
    ctx.session.qr_code = false;
    ctx.scene.enter("qr_code");
  }
});

// Действия по нажатию кнопки из keyboard
bot.hears("🗂️ Меню", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.replyWithPhoto(
    "https://i.ibb.co/qYJqZjqG/card-1001.jpg",
    {
      caption: "Меню бота",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✨ Накрутка подписчиков", callback_data: `pay_balance` }
          ],
          [
            { text: "👀 Накрутка просмотров", callback_data: `ai_menu` }
          ],
          [
            { text: "❤️ Накрутка реакций", callback_data: `check_sub` }
          ],
          [
            { text: "💳 Пополнить баланс", callback_data: `pay_balance` }
          ],
          [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
        ],
      },
    }
  );
});
bot.hears("👨‍💻 Связь с админом", async (ctx) => {
  await ctx.deleteMessage();
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});
bot.hears("👨 Личный кабинет", async (ctx) => {
  const { id, first_name, username, language_code } = ctx.from;
  dataBase.findOne({ username }).then(async (res) => {
    await ctx.deleteMessage();
    await ctx.reply(
      `<b>Информация по 👨 аккаунту:</b>\n🆔 ID: <code>${res.id}</code>
💰 Баланс: ${res.balance} ₽

🤝 Партнерская программа: - /ref
‍├ Рефералов: ${res.referrals}
`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
          ],
        },
      }
    );
  });
});

// Комманды
bot.command("start", async (ctx) => {
  const { id, first_name, username, language_code } = ctx.from;
  const refHashRaw = ctx.payload;
  
  console.log(refHashRaw);

  dataBase.findOne({ id, first_name, username }).then(async (res) => {
    if (!res) {
      console.log("Запись  создаеться");
      dataBase.insertOne({
        id,
        first_name,
        username,
        language_code,
        referrals: 0,
        ref_code: refCode(),
        date: dateNow(),
        balance: 0,
        data_channel: null,
      });
      if(refHashRaw){
        const refHash = refHashRaw.split('_')[1];
        dataBase.updateOne({ ref_code: refHash }, { $inc: { referrals: 1 } });
      }
    } else {
      console.log("Запись уже создана");
    }
  });

  ctx.replyWithPhoto("https://i.ibb.co/0jmGR3S4/card-1000.jpg", {
    caption: `
    🚀 Добро пожаловать в HardBoost!

Твой инструмент для быстрого роста статистики в Telegram:

✨ Накрутка подписчиков – боты 
👀 Увеличение просмотров – мгновенный результат
❤️ Разные реакции  – для видимости постов

🔥 Почему выбирают нас?
✔ Мгновенный старт – без ожидания
✔ Анонимно и безопасно – никаких блокировок
✔ Лучшие цены – дешевле, чем у конкурентов
    
    `,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗂️ Меню", callback_data: `menu` }],
        [
          { text: "👨 Личный кабинет", callback_data: `translate` }
        ],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});


bot.command('ref', async (ctx) => {
  const { id } = ctx.from;
  dataBase.findOne({ id }).then(async (res)  => { 
    const refLink = `https://t.me/${ctx.botInfo.username}?start=ref_${res.ref_code}`;
    await ctx.reply(`🔗 Ваша реферальная ссылка:\n<code>${refLink}</code>\n\nПриглашайте друзей и получайте бонусы! 🎁`, { parse_mode: 'HTML' });
  })
  
});


bot.command("drop", async (ctx) => {
  dataBase.deleteMany({});
  ctx.reply("DROP COLLECTION");
});

bot.command("about", async (ctx) => {
  ctx.replyWithPhoto("https://i.ibb.co/rf08CWL0/card-1008.jpg", {
    caption: `✨ <b>Что я умею:</b>\n<blockquote>• Генерировать QR-коды
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
</blockquote>

`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "🗂️ Меню", callback_data: `menu` }]],
    },
  });
});

bot.command("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});

bot.command("db", async (ctx) => {
  dataBase.find({}).then((res) => {
    ctx.reply("```js" + JSON.stringify(res, null, 2) + "```", {
      parse_mode: "Markdown",
    });
  });
});

bot.command("stop", async (ctx) => {
  if(ctx.session.ai_disabled){
    ctx.session.ai_disabled = false;
  }
});


// bot.telegram.sendPhoto(
//   ADMIN_ID,
//   "https://quickchart.io/qr?text=https://best-earn.vercel.app&size=400",
//   {
//     caption: `🔔 <b>Ответ Администратора</b> >
//   \n<blockquote>Пусто</blockquote>`,
//     parse_mode: "HTML",
//   }
// );

//bot.on('text', ctx => console.log(ctx.update.message.from));

const delay = ms => new Promise(res => { setTimeout(() => res(),ms) });


const messageAi = { }

bot.on('message', async (ctx) =>{
  if(ctx.session.ai_disabled){
    console.log('Написал мне');
    await ctx.replyWithChatAction('typing');
    const txt = ctx.message.text;
    //await delay(2000);  
    const res = await askAI(txt) ?? 'Большая нагрузка попробуйте позже';
     //reply_to_message_id: ctx.message.message_id
    await ctx.reply(`🔔 <b>Ответ DeepSeek</b> >\n<blockquote>${res}</blockquote>`, {
      parse_mode: "HTML",
      reply_to_message_id: ctx.message.message_id
    });
    
  }
})





bot.launch();


const TOKEN1 =
'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';
const TOKEN2 =
'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';
async function askAI(ask){
  return await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      "model": "deepseek/deepseek-chat-v3-0324:free",
      "messages": [
        {
          "role": "user",
          "content": ask
        }
      ]
    },{
     headers: {
      "Authorization": `Bearer ${TOKEN1}`,
      "HTTP-Referer": "https://guttural-hurricane-pixie.glitch.me/sleep", // Optional. Site URL for rankings on openrouter.ai.
      "X-Title": "Mutual Boost 2", // Optional. Site title for rankings on openrouter.ai.
      "Content-Type": "application/json"
    }      
  
  
  }).then( async (res) =>{
    const response = await res.data.choices[0].message.content;
    console.log(response);
    return response
  })
  .catch(async (e) => {
    console.log(e)
  })
} 
//askAI('Hello')




function dateNow() {
  return new Date().getTime();
}

app.get("/sleep", async (req, res) => {
  res.send({ type: 200 });
});

app.post('/ai', async (req,res) =>{
  const { ask }  = req.body;
  //console.log(req.body)
  //await delay(2000);
  
  const answer = await askAI(ask);
  await res.send({ answer });
});




app.listen(3000, (err) => {
  err ? err : console.log("STARTED SERVER");
});



