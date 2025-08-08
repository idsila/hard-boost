require("dotenv").config();

const commands = require("./commands.js");
const dataBase = require("./dataBase.js");

const { Telegraf, session, Scenes } = require("telegraf");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const fs = require("fs");

const obj = JSON.parse(fs.readFileSync("log.json"));

const followers = obj.filter((item) => item.category === "Telegram");
const views = obj.filter( (item) => item.name.includes("росмотр") && item.category === "Telegram реакции/просмотры");
const reactions = obj.filter(
  (item) =>
    item.name.includes("еакци") &&
    item.category === "Telegram реакции/просмотры"
);
const boosts = obj.filter((item) => item.category === "Telegram Boost");
const stars = obj.filter((item) => item.category === "Telegram Stars");

app.use(cors({ methods: ["GET", "POST"] }));
app.use(express.json());

const ADMIN_ID = 7502494374;

const bot = new Telegraf(process.env.TOKEN);
bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),

    defaultSession: () => ({ order_followers: false }),
    defaultSession: () => ({ ai_disabled: false }),
    defaultSession: () => ({ ai_answer: false }),
  })
);

function refCode(n = 6) {
  const symbols =
    "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
  let user_hash = "";
  for (let i = 0; i != n; i++) {
    user_hash += symbols[Math.floor(Math.random() * symbols.length)];
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
    ctx.reply("<b>Можете задать любой вопрос, если возникли трудности. Также можно прикрепить фото.</b>", {
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

const orderFollowers = new Scenes.WizardScene(
  "order_followers",
  (ctx) => {
    ctx.session.order_followers = true;
    
    if (ctx.callbackQuery?.data === "cancel_scena" ) {
      ctx.session.order_followers = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }
    
    const currentService = followers.find((item) => item.service == ctx.wizard.state.service);

    if (ctx.message?.text >= currentService.min && ctx.message?.text <= currentService.max) {
      ctx.reply(
        `<b>📝 Отправьте сылку на канал:</b>
<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/username</code>

<blockquote>Услуга: ${currentService.name}</blockquote>
`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "❌ Отменить",
                  callback_data: "cancel_scena",
                },
              ],
            ],
          },
        }
      );
      ctx.wizard.state.amount = ctx.message?.text * 1;
      ctx.wizard.state.pay =
        (currentService.rate / 1000) * (ctx.message?.text * 1);
      ctx.wizard.state.currentService = currentService;
      return ctx.wizard.next();
    } else {
      ctx.reply(
        `<b>📝 Напишите нужное вам колличество:</b>

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ценна за 1шт: ${(currentService.rate / 1000).toLocaleString(
          "ru-RU"
        )}</blockquote>
<blockquote>Минимум: ${currentService.min.toLocaleString("ru-RU")}</blockquote>
<blockquote>Максимум: ${currentService.max.toLocaleString("ru-RU")}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "❌ Отменить",
                  callback_data: "cancel_scena",
                },
              ],
            ],
          },
        }
      );
    }
  },
  (ctx) => {
    console.log(ctx.callbackQuery?.data)
    if (ctx.callbackQuery?.data === "cancel_scena" ) {
      ctx.session.order_followers = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }
    
    //console.log(ctx.wizard.state);
    const currentService = followers.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (ctx.message?.text.includes("https://t.me/")) {
      const idOrder = refCode();
      ctx.reply(
        `<b>📝 Оплатите заказ: #${idOrder}</b>

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ваше колличество: ${ctx.wizard.state.amount.toLocaleString(
          "ru-RU"
        )}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString(
          "ru-RU"
        )}₽</blockquote>
<blockquote>Сылка: ${ctx.message?.text}</blockquote>
       
        
            `,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 Оплатить",
                  callback_data: "pay",
                },
              ],
            ],
          },
        }
      );
      console.log("NEXT2");
      ctx.session.order_followers = false;
      return ctx.scene.leave();
    } else {
      ctx.reply(
        `<b>📝 Отправьте сылку на канал:</b>
<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/username</code>
        
<blockquote>Услуга: ${currentService.name}</blockquote>
`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "❌ Отменить",
                  callback_data: "cancel_scena",
                },
              ],
            ],
          },
        }
      );
    }
  }
);

const stage = new Scenes.Stage([writeHelp, writeHelpAdmin, orderFollowers]);
bot.use(stage.middleware());

// Действия по нажатию inline кнопки
bot.action(/^user/i, async (ctx) => {
  if (!ctx.session.write_admin) {
    ctx.session.write_admin = false;
    const [, id, username] = ctx.match.input.split("_");
    ctx.scene.enter("write_help_admin", { id, username });
  }
});

bot.action(/^followers_/i, async (ctx) => {
  if (!ctx.session.order_followers) {
    ctx.session.order_followers = false;
    const [, id, service] = ctx.match.input.split("_");

    ctx.scene.enter("order_followers", { id, service });
  }
});

bot.action("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});

bot.action("menu", async (ctx) => {
  ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "Выберите один из представленных товаров.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Подписчики", callback_data: `buy_followers` },
          { text: "👀 Просмотры", callback_data: `buy_views` },
        ],
        [
          { text: "❤️ Реакции", callback_data: `buy_reactions` },
          { text: "☄️ Буст Канала", callback_data: `buy_boosts` },
        ],
        [{ text: "⭐ Звезды", callback_data: `buy_stars` }],
        [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});

bot.action("menu_back", async (ctx) => {
  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg",
      caption: "Выберите один из представленных товаров.",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✨ Подписчики", callback_data: `buy_followers` },
            { text: "👀 Просмотры", callback_data: `buy_views` },
          ],
          [
            { text: "❤️ Реакции", callback_data: `buy_reactions` },
            { text: "☄️ Буст Канала", callback_data: `buy_boosts` },
          ],
          [{ text: "⭐ Звезды", callback_data: `buy_stars` }],
          [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
          [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
        ],
      },
    }
  );
});

bot.action("pay_balance", async (ctx) => {
  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.ibb.co/tTQ574gv/card-1002.jpg",
      caption: "<b>💸 Это все способы пополнения баланса.</b>",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💳 Карта", callback_data: `pay_umoney` },
            { text: "🧠 Крипта", callback_data: `pay_crypto` },
          ],
          [{ text: "<< Назад", callback_data: `menu_back` }],
        ],
      },
    }
  );
});

bot.action("pay_umoney", async (ctx) => {
  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.ibb.co/fbWNWJY/card-1003.jpg",
      caption: "<b>💸 Это пополнения баланса через ЮMoney.</b>",
      parse_mode: "HTML",
    },
    {
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





//Действия по кнопке для показа товаров накрутки

bot.action("buy_followers", async (ctx) => {
  const { id } = ctx.from;

  const keyboard = followers.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: `followers_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);
  
   await ctx.editMessageMedia(
    {
    type: "photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg",
    caption: "Ниже представденны тарифы и их ценны за 1 тысяу.",
    parse_mode: "HTML"
    },
    {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
});

bot.action("buy_views", async (ctx) => {
  const keyboard = views.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: item.service,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
    type: "photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg", 
    caption: "Ниже представденны тарифы и их ценны за 1 тысяу.",
    parse_mode: "HTML"
    },{
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
});

bot.action("buy_reactions", async (ctx) => {
  const keyboard = reactions.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: item.service,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
    type: "photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg", 
    caption: "Ниже представденны тарифы и их ценны за 1 тысяу.",
    parse_mode: "HTML"
    },{
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
});

bot.action("buy_boosts", async (ctx) => {
  const keyboard = boosts.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: item.service,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
    type: "photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg", 
    caption: "Ниже представденны тарифы и их ценны за 1шт.",
    parse_mode: "HTML"
    },{
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
});

bot.action("buy_stars", async (ctx) => {
  const keyboard = stars.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: item.service,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
    type: "photo",
    media: "https://i.ibb.co/qYJqZjqG/card-1001.jpg", 
    caption: "Ниже представденны тарифы оптом за 1 тысяу",
    parse_mode: "HTML"
    },{
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
});


// Получение id канал для проверки подписки
bot.on("channel_post", async (ctx) => {
  const {
    chat: { id, title },
  } = ctx.channelPost;
  console.log(id, title);
  dataBase.findOne({ id }).then(async (res) => {
    if (!res) {
      console.log("Добавлен канал");
      dataBase.insertOne({ id, title });
    }
  });
});

bot.command("check", async (ctx) => {
  const { id } = ctx.from;
  const use = await bot.telegram.getChatMember(-1002760111651, id);
  if (use.status !== "left") {
    ctx.reply("+");
  } else {
    ctx.reply("-");
  }
});



// Действия по нажатию кнопки из keyboard
bot.hears("🗂️ Меню", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "Выберите один из представленных товаров.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Подписчики", callback_data: `buy_followers` },
          { text: "👀 Просмотры", callback_data: `buy_views` },
        ],
        [
          { text: "❤️ Реакции", callback_data: `buy_reactions` },
          { text: "☄️ Буст Канала", callback_data: `buy_boosts` },
        ],
        [{ text: "⭐ Звезды", callback_data: `buy_stars` }],
        [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});
bot.hears("👨‍💻 Задать вопрос", async (ctx) => {
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
      if (refHashRaw) {
        const refHash = refHashRaw.split("_")[1];
        dataBase.updateOne({ ref_code: refHash }, { $inc: { referrals: 1 } });
      }
    } else {
      console.log("Запись уже создана");
    }
  });

  ctx.replyWithPhoto("https://i.ibb.co/0jmGR3S4/card-1000.jpg", {
    caption: ` <b>🚀 Добро пожаловать в HardBoost!</b>

<blockquote><b>Твой инструмент для быстрого роста:</b>
✨ Накрутка подписчиков – боты 
👀 Увеличение просмотров – мгновенный результат
❤️ Разные реакции  – для видимости постов
</blockquote>
<blockquote><b>Почему выбирают нас?</b>
📌 Мгновенный старт – без ожидания
📌 Анонимно и безопасно – никаких блокировок
📌 Лучшие цены – дешевле, чем у конкурентов
</blockquote>
    
`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "🗂️ Меню", callback_data: `menu` }],
        [{ text: "👨 Личный кабинет", callback_data: `translate` }],
        [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
      ],
    },
  });
});

bot.command("ref", async (ctx) => {
  const { id } = ctx.from;
  dataBase.findOne({ id }).then(async (res) => {
    const refLink = `https://t.me/${ctx.botInfo.username}?start=ref_${res.ref_code}`;
    await ctx.reply(
      `🔗 Ваша реферальная ссылка:\n<code>${refLink}</code>\n\nПриглашайте друзей и получайте бонусы! 🎁`,
      { parse_mode: "HTML" }
    );
  });
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





//bot.on('text', ctx => console.log(ctx.update.message.from));

const delay = (ms) =>
  new Promise((res) => {
    setTimeout(() => res(), ms);
  });



bot.launch();


function dateNow() {
  return new Date().getTime();
}

app.get("/sleep", async (req, res) => {
  res.send({ type: 200 });
});

app.listen(3000, (err) => {
  err ? err : console.log("STARTED SERVER");
});
