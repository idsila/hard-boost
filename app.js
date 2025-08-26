require("dotenv").config();

const commands = require("./commands.js");
const dataBase = require("./dataBase.js");
const orderBase = require("./orderBase.js");

const { Telegraf, session, Scenes } = require("telegraf");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const querystring = require("querystring");
const fs = require("fs");
const { channel } = require("diagnostics_channel");

const obj = JSON.parse(fs.readFileSync("log.json"));

const followers = obj.filter((item) => item.category === "Telegram");
const views = obj.filter(
  (item) =>
    item.name.includes("росмотр") &&
    item.category === "Telegram реакции/просмотры"
);
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
const OPTSMM_KEY = process.env.OPTSMM_KEY;
bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),

    defaultSession: () => ({ order_scena: false }),
    // defaultSession: () => ({ bonus_scena: false }),
  })
);


// let count = 0;

let timerOrder = null;


bot.on("chat_join_request", async (ctx) => {
  const { chat, from: { id, first_name, username } } = ctx.chatJoinRequest;

  dataBase.findOne({ chat_id: chat.id }).then(async (res) => {
    console.log(res?.subscribers);
    if(!res){
      
    }
    else{
      dataBase.updateOne({ chat_id: chat.id }, { $inc: { subscribers: 1 } });
      clearInterval(timerOrder);

      timerOrder = setInterval(() => {

        axios(`https://optsmm.ru/api/v2?action=status&order=${res.order}&key=${OPTSMM_KEY}`)
        .then(optsmm => {
          const { status } = optsmm.data;
          
          
          if(status != 'In progress' || status != 'Awaiting'){
            console.log(optsmm.data.status);
            if(res.subscribers < res.limit){
              axios(`https://optsmm.ru/api/v2?action=add&service=84&link=${res.url}&quantity=1000&key=${OPTSMM_KEY}`)
              .then(optsmm => {
                ctx.reply('Заказал еще');
                console.log('Заказал еще', optsmm.data.order);
                dataBase.updateOne({ chat_id: res.chat_id }, { $set: { order: optsmm.data.order } });
              });
            }
            else{
              ctx.replyWithPhoto("https://i.postimg.cc/Y0SQY9pp/card-final.jpg", {
                caption: ` <b>🎉 Все подписчики накрученны!</b>       
<blockquote><b>Колличество:</b> ${res.subscribers}/${res.limit}🚀</blockquote>
              
            `,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🗑️ Удалить пост", callback_data: "remove_post" }]
             ],
                },
              });
              clearInterval(timerOrder);
            }
          }
          else{
            ctx.reply('Еще не всё!');
          }
        });
      }, 2000 * 5);
    }
  });


  // count++;
  // console.log( chat, id, first_name, username );
  // console.log(count);

  //{ id: -1003042621539, title: 'Взаимные подписки', type: 'channel' } 7502494374 idsilax idsilax
});

//1



//bot.telegram.setMyCommands(commands);

//Сцены

const writeHelp = new Scenes.WizardScene(
  "write_help",
  (ctx) => {
    ctx.session.write_user = true;
    ctx.reply(
      "<b>Можете задать любой вопрос, если возникли трудности. Также можно прикрепить фото.</b>",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Отменить", callback_data: "cancel_write_help" }],
          ],
        },
      }
    );
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
    ctx.session.order_scena = true;

    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = followers.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (
      ctx.message?.text >= currentService.min &&
      ctx.message?.text <= currentService.max
    ) {
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
<blockquote>Максимум: ${currentService.max.toLocaleString(
          "ru-RU"
        )}</blockquote>`,
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
    console.log(ctx.callbackQuery?.data);
    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = followers.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (ctx.message?.text.includes("https://t.me/")) {
      dataBase.findOne({ id: ctx.from.id }).then((res_0) => {
        if (res_0.balance >= ctx.wizard.state.pay) {
          const idOrder = refCode();
          const URL = ctx.message?.text.trim();
          orderBase
            .insertOne({
              id: idOrder,
              customer: ctx.from.id,
              service: currentService.service,
              amount: ctx.wizard.state.amount,
              price: ctx.wizard.state.pay,
              url: URL,
              ready: false,
            })
            .then((res) => {
              ctx.reply(
                `<b>📝 Оплатите заказ: #${idOrder}</b>
  
<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ваше колличество: ${ctx.wizard.state.amount.toLocaleString(
                  "ru-RU"
                )}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString(
                  "ru-RU"
                )}₽</blockquote>
<blockquote>Сылка: ${URL}</blockquote> `,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "💳 Оплатить",
                          callback_data:`pay_order_${idOrder}`,
                        },
                      ],
                    ],
                  },
                }
              );
              console.log("CREATE ORDER");
              ctx.session.order_scena = false;
              return ctx.scene.leave();
            });
        }
        else{
          ctx.reply(`<b>⚠️ Упс у вас не достаточно средств: </b>
<blockquote>💰 Баланс: ${res_0.balance.toLocaleString("ru-RU")}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString("ru-RU")}₽</blockquote>
    `,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
                  [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
                ],
              },
            }
          );
          ctx.session.order_scena = false;
          return ctx.scene.leave();
        }
      });
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







const orderBoosts = new Scenes.WizardScene(
  "order_boosts",
  (ctx) => {
    ctx.session.order_scena = true;

    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = boosts.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (
      ctx.message?.text >= currentService.min &&
      ctx.message?.text <= currentService.max
    ) {
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
        (currentService.rate) * (ctx.message?.text * 1);
      ctx.wizard.state.currentService = currentService;
      return ctx.wizard.next();
    } else {
      ctx.reply(
        `<b>📝 Напишите нужное вам колличество:</b>

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ценна за 1шт: ${(currentService.rate).toLocaleString(
          "ru-RU"
        )}₽</blockquote>
<blockquote>Минимум: ${currentService.min.toLocaleString("ru-RU")}</blockquote>
<blockquote>Максимум: ${currentService.max.toLocaleString(
          "ru-RU"
        )}</blockquote>`,
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
    console.log(ctx.callbackQuery?.data);
    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = boosts.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (ctx.message?.text.includes("https://t.me/")) {
      dataBase.findOne({ id: ctx.from.id }).then((res_0) => {
        if (res_0.balance >= ctx.wizard.state.pay) {
          const idOrder = refCode();
          const URL = ctx.message?.text.trim();
          orderBase
            .insertOne({
              id: idOrder,
              customer: ctx.from.id,
              service: currentService.service,
              amount: ctx.wizard.state.amount,
              price: ctx.wizard.state.pay,
              url: URL,
              ready: false,
            })
            .then((res) => {
              ctx.reply(
                `<b>📝 Оплатите заказ: #${idOrder}</b>
  
<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ваше колличество: ${ctx.wizard.state.amount.toLocaleString(
                  "ru-RU"
                )}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString(
                  "ru-RU"
                )}₽</blockquote>
<blockquote>Сылка: ${URL}</blockquote> `,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "💳 Оплатить",
                          callback_data:`pay_order_${idOrder}`,
                        },
                      ],
                    ],
                  },
                }
              );
              console.log("CREATE ORDER");
              ctx.session.order_scena = false;
              return ctx.scene.leave();
            });
        }
        else{
          ctx.reply(`<b>⚠️ Упс у вас не достаточно средств: </b>
<blockquote>💰 Баланс: ${res_0.balance.toLocaleString("ru-RU")}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString("ru-RU")}₽</blockquote>
    `,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
                  [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
                ],
              },
            }
          );
          ctx.session.order_scena = false;
          return ctx.scene.leave();
        }
      });
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




const createOrder = new Scenes.WizardScene(
  "create_order",
  (ctx) => {
    ctx.session.order_scena = true;

    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = obj.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (
      ctx.message?.text >= currentService.min &&
      ctx.message?.text <= currentService.max
    ) {
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
        )}₽</blockquote>
<blockquote>Минимум: ${currentService.min.toLocaleString("ru-RU")}</blockquote>
<blockquote>Максимум: ${currentService.max.toLocaleString(
          "ru-RU"
        )}</blockquote>`,
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
    console.log(ctx.callbackQuery?.data);
    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    const currentService = obj.find(
      (item) => item.service == ctx.wizard.state.service
    );

    if (ctx.message?.text.includes("https://t.me/")) {
      dataBase.findOne({ id: ctx.from.id }).then((res_0) => {
        if (res_0.balance >= ctx.wizard.state.pay) {
          const idOrder = refCode();
          const URL = ctx.message?.text.trim();
          orderBase
            .insertOne({
              id: idOrder,
              customer: ctx.from.id,
              service: currentService.service,
              amount: ctx.wizard.state.amount,
              price: ctx.wizard.state.pay,
              url: URL,
              ready: false,
            })
            .then((res) => {
              ctx.reply(
                `<b>📝 Оплатите заказ: #${idOrder}</b>
  
<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ваше колличество: ${ctx.wizard.state.amount.toLocaleString(
                  "ru-RU"
                )}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString(
                  "ru-RU"
                )}₽</blockquote>
<blockquote>Сылка: ${URL}</blockquote> `,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "💳 Оплатить",
                          callback_data:`pay_order_${idOrder}`,
                        },
                      ],
                    ],
                  },
                }
              );
              console.log("CREATE ORDER");
              ctx.session.order_scena = false;
              return ctx.scene.leave();
            });
        }
        else{
          ctx.reply(`<b>⚠️ Упс у вас не достаточно средств: </b>
<blockquote>💰 Баланс: ${res_0.balance.toLocaleString("ru-RU")}</blockquote>
<blockquote>Сумма к списанию: ${ctx.wizard.state.pay.toLocaleString("ru-RU")}₽</blockquote>
    `,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }],
                  [{ text: "👨‍💻 Задать вопрос", callback_data: `help` }],
                ],
              },
            }
          );
          ctx.session.order_scena = false;
          return ctx.scene.leave();
        }
      });
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




const bonusOrder = new Scenes.WizardScene(
  "bonus_order",
  (ctx) => {
    ctx.session.order_scena = true;

    if (ctx.callbackQuery?.data === "cancel_scena") {
      ctx.session.order_scena = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }
    const currentService = obj.find((item) => item.service == 84);

    


    



    if (ctx.message?.text.includes("https://t.me/")) {
      const URL = ctx.message?.text.trim();
      const currentPrice = (currentService.rate/1000)*300;
      const idOrder = `FIRST_${refCode()}`;
          orderBase
            .insertOne({
              id: idOrder,
              customer: ctx.from.id,
              service: 84,
              amount: 300,
              price: currentPrice,
              url: URL,
              ready: true,
            })
            .then((res) => {
              ctx.reply(`<b>✅ Заказ оплачен: #${idOrder}</b>
Ожидайте в течение нескольких минут вы получите результат.

<blockquote><b>Услуга:</b> Бонус от HardBoost</blockquote>
<blockquote><b>Ваше колличество:</b> 100</blockquote>
<blockquote><b>Сылка:</b> ${URL}</blockquote> `,
                {
                  parse_mode: "HTML"
                }
              );
              dataBase.updateOne({ id: ctx.from.id }, { $set: { bonus:false }});


              axios(`https://optsmm.ru/api/v2?action=add&service=84&link=${URL}&quantity=300&key=${OPTSMM_KEY}`)
              .then(optsmm => {
                console.log("CREATE ORDER", URL);
              });
              
              ctx.session.order_scena = false;
              return ctx.scene.leave();
            });
        

      
    } else {
      ctx.reply(`<b>📝 Отправьте сылку на канал:</b>
<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/username</code>
        
<blockquote><b>Услуга:</b> Бонус от HardBoost</blockquote>
<blockquote><b>Ваше колличество:</b> 100</blockquote>
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




















const stage = new Scenes.Stage([writeHelp, writeHelpAdmin, createOrder, orderBoosts, bonusOrder]);
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
  if (!ctx.session.order_scena) {
    ctx.session.order_scena = false;
    const [, id, service] = ctx.match.input.split("_");
    ctx.scene.enter("create_order", { id, service });
  }
});
bot.action(/^views_/i, async (ctx) => {
  if (!ctx.session.order_scena) {
    ctx.session.order_scena = false;
    const [, id, service] = ctx.match.input.split("_");
    ctx.scene.enter("create_order", { id, service });
  }
});


bot.action(/^reactions_/i, async (ctx) => {
  if (!ctx.session.order_scena) {
    ctx.session.order_scena = false;
    const [, id, service] = ctx.match.input.split("_");
    ctx.scene.enter("create_order", { id, service });
  }
});

bot.action(/^boosts_/i, async (ctx) => {
  if (!ctx.session.order_scena) {
    ctx.session.order_scena = false;
    const [, id, service] = ctx.match.input.split("_");
    ctx.scene.enter("order_boosts", { id, service });
  }
});

bot.action(/^stars_/i, async (ctx) => {
  if (!ctx.session.order_scena) {
    ctx.session.order_scena = false;
    const [, id, service] = ctx.match.input.split("_");
    ctx.scene.enter("create_order", { id, service });
  }
});

bot.action(/^status_order_/i, async (ctx) => {
  const [,, order] = ctx.match.input.split("_");
  axios(`https://optsmm.ru/api/v2?action=status&order=${order}&key=${OPTSMM_KEY}`)
  .then(optsmm => {
    console.log(optsmm.data);
    ctx.reply(`<b>👁️ Статус Заказа: </b>    
<blockquote>🔄 Статус: ${optsmm.data.status}</blockquote>
<blockquote>⏳ Осталось: ${(optsmm.data.remains*1).toLocaleString("ru-RU")}</blockquote>
<blockquote>💰 Заряд: ${(optsmm.data.charge*1).toLocaleString("ru-RU")}₽</blockquote>
`,
      {
        parse_mode: "HTML",
      }
    );
  });
  
});



bot.action(/^pay_order_/i, async (ctx) => {
  const id = ctx.from.id;
    const idOrder = ctx.match.input.split("_")[2];
    orderBase.findOne({ id: idOrder }).then(res_0 => {
      if(!res_0.ready){ 
        dataBase.findOne({ id: id }).then(res_1 => {
          if(res_1.balance >= res_0.price){
            axios(`https://optsmm.ru/api/v2?action=add&service=${res_0.service}&link=${res_0.url}&quantity=${res_0.amount}&key=${OPTSMM_KEY}`)
            .then(optsmm => {
              ctx.deleteMessage();
              dataBase.updateOne({ id: id }, { $inc : { balance: -res_0.price }});
              orderBase.updateOne({ id: idOrder }, { $set : { ready: true, order: optsmm.data.order}});
              const currentService = obj.find((item) => item.service == res_0.service);
              ctx.reply(`<b>✅ Заказ оплачен: #${idOrder}</b>
Ожидайте в течение нескольких минут вы получите результат.

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ваше колличество: ${res_0.amount.toLocaleString("ru-RU")}</blockquote>
<blockquote>Сумма к списанию: ${res_0.price.toLocaleString("ru-RU")}₽</blockquote>
<blockquote>Сылка: ${res_0.url}</blockquote> `,
                {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "👁️ Статус заказа",
                        callback_data: `status_order_${optsmm.data.order}`,
                      },
                    ],
                  ],
                },
                }
              );
              console.log('Опалата успешно');

            })
            .catch(() => {
              ctx.reply(`<b>❌ Ошибка заказа: #${idOrder}</b>
Если это произошло не первый раз обратитесь в поддержку!
                `,
                {
                  parse_mode: "HTML"
                });
                console.log('Опалата не успешно');
            })
          }
        })
      }
      else{
        console.log('Уже было оплаченно');
      }
    });  
});


bot.action(/^pay_umoney_/i, async (ctx) => {
  const id = ctx.from.id;
  const amountOrder = ctx.match.input.split("_")[2];

  const currenLable = refCode(10);

  const link = createQuickpayLink({ receiver: "4100119146265962", sum: amountOrder*1, label: currenLable, targets: `Оплата #${currenLable}` });


    orderBase.insertOne( { id, lable: currenLable, amount: amountOrder*1, status: false }).then(res_2 => {
      ctx.reply(`<b>💳 Ссылка на оплату сгенерирована #${currenLable}</b>
<blockquote><b>⚡️ Обратите внимание: сервис удерживает 3% комиссии, но мы покрываем её за вас! </b> </blockquote>`
            ,{  
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [ { text: `Пополнить на ${amountOrder}₽`, url: link } ],
                  [ { text: `Проверить оплату`, callback_data: `umoney_lable_${currenLable}` } ]
                ] 
              }
            });
    })
    


});

bot.action(/^umoney_lable_/i, async (ctx) => {
  const id = ctx.from.id;
  const currenLable = ctx.match.input.split("_")[2];

  console.log(currenLable);

  const response = await axios.post(
    "https://yoomoney.ru/api/operation-history",
    { label: currenLable }, // фильтруем по вашему label
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
  
    const operations = response.data.operations || [];
    if (operations.length === 0) {
      ctx.reply(`<b>❌ Платеж с таким #${currenLable} не найден</b>`, { parse_mode: 'HTML'});
      return false;
    }
  
    const payment = operations[0]; // последний платёж с этим label
    if (payment.status === "success") {
      console.log(payment)
      await ctx.deleteMessage();
     
      orderBase.findOne({ lable: currenLable }).then(async (order) => {
        ctx.reply(`<b>✅ Оплата подтверждена #${currenLable}</b>
<blockquote>Cумма пополнения: <b>${order.amount}₽</b></blockquote>`, { parse_mode: 'HTML'});
        orderBase.updateOne({ lable: currenLable }, { $set: { status: true } });
        dataBase.updateOne({ id: order.id }, { $inc: { balance: order.amount*1 } });
      });
      return true;
    } else {
      ctx.reply("⏳ Платёж ещё не завершён");
      return false;
    }
  

});


bot.action(/^pay_crypto_/i, async (ctx) => {
  const id = ctx.from.id;
  const amountOrder = ctx.match.input.split("_")[2];
  console.log(amountOrder)

  axios.post(`https://pay.crypt.bot/api/createInvoice`,
    {
      currency_type: "fiat", 
      fiat: "RUB",           
      amount: amountOrder,       
      accepted_assets: "USDT",
      description: `Пополнение баланса на ${amountOrder}₽`
    },
    {
      headers: {
        "Crypto-Pay-API-Token": process.env.TOKEN_CRYPTO,
      },
    }
  ).then(res => {
    const { invoice_id, amount, created_at, bot_invoice_url } = res.data.result;

    orderBase.insertOne( { invoice_id, amount, created_at, bot_invoice_url, id }).then(res_2 => {
      ctx.reply(`<b>💳 Ссылка на оплату сгенерирована!</b>
<blockquote><b>⚡️ Обратите внимание: сервис удерживает 3% комиссии, но мы покрываем её за вас! </b> </blockquote>`
            ,{  
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [ { text: `Пополнить на ${amountOrder}₽`, url: bot_invoice_url } ]
                ] 
              }
            });
    })
    
  })

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



bot.action("pay_crypto", async (ctx) => {
  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.ibb.co/JRwY2T6L/card-1004.jpg",
      caption: "<b>💸 Это пополнения баланса через Крипту.</b>",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "100₽", callback_data: `pay_crypto_100` },
            { text: "200₽", callback_data: `pay_crypto_200` },
            { text: "300₽", callback_data: `pay_crypto_300` },
          ],
          [
            { text: "500₽", callback_data: `pay_crypto_500` },
            { text: "1000₽", callback_data: `pay_crypto_1000` },
            { text: "5000₽", callback_data: `pay_crypto_5000` },
          ],
          [{ text: "<< Назад", callback_data: `pay_balance` }],
        ],
      },
    }
  );
});


bot.action("get_bonus", async (ctx) => {
  await ctx.deleteMessage();
  dataBase.findOne({ id: ctx.from.id}).then(user => {
    if(user.bonus){
      console.log(user.bonus)
      if (!ctx.session.order_scena) {
        ctx.session.order_scena = false;
        ctx.scene.enter("bonus_order");
      }
    }
    else{
      const { id } = ctx.from;

ctx.replyWithPhoto("https://i.ibb.co/0jmGR3S4/card-1000.jpg", {
    caption: ` <b>🔒 Бонус использован!</b>

<blockquote><b>Вы уже получили свои 100 бесплатных подписчиков 👥</b>
Продолжайте раскручивать канал — впереди ещё больше возможностей 🚀
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
    }

  });
});




bot.action("remove_post", async (ctx) => {
  await ctx.deleteMessage();
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
      media: "https://i.postimg.cc/TP7QrpSm/card-subers.jpg",
      caption: "Ниже представденны тарифы и их ценны за 1 тысячу.",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
});

bot.action("buy_views", async (ctx) => {
  const { id } = ctx.from;
  const keyboard = views.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: `views_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/gcRq0SY3/card-views.jpg",
      caption: "Ниже представденны тарифы и их ценны за 1 тысячу.",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
});

bot.action("buy_reactions", async (ctx) => {
  const { id } = ctx.from;
  const keyboard = reactions.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: `reactions_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/rsCrNHmb/card-reactions.jpg",
      caption: "Ниже представденны тарифы и их ценны за 1 тысячу.",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
});

bot.action("buy_boosts", async (ctx) => {
  const { id } = ctx.from;
  const keyboard = boosts.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: `boosts_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/508Yfrw0/card-boosts.jpg",
      caption: "Ниже представденны тарифы и их ценны за 1шт.",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
});

bot.action("buy_stars", async (ctx) => {
  const { id } = ctx.from;
  const keyboard = stars.map((item) => {
    return [
      {
        text: `${item.name} → ${item.rate.toFixed(1)}₽`,
        callback_data: `stars_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/Wb13yzft/card-1005.jpg",
      caption: "Ниже представденны тарифы оптом за 1 тысячу",
      parse_mode: "HTML",
    },
    {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    }
  );
});














// Получение id канал для проверки подписки


bot.on("channel_post", async (ctx) => {
  const { text, chat: { id, title } } = ctx.channelPost;
  
  if(text.includes('/start')){
    const amount = text.split(" ")[1];
    const URL = text.split(" ")[2];


    await ctx.deleteMessage();
    ctx.replyWithPhoto("https://i.postimg.cc/W3nhtkWc/card-channel.jpg",{ caption:`<b>🚀 Подписчики накручены с помощью HardBoost!</b>

<b>⚡️ Быстро, безопасно и удобно</b>
<b>💰 Самые низкие цены на рынке</b>

<blockquote><b>🎁 Бонус для первых посетителей:</b>
Получите 100 подписчиков бесплатно – без риска, без условий!</blockquote>

<blockquote>💡 Присоединяйтесь и убедитесь сами, как легко растёт канал с HardBoost!</blockquote>`, 
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Получить бонус", url: `https://t.me/hardBoost_bot` }]
      ],
    }
    });


    dataBase.findOne({ chat_id: id }).then(async (res) => {
      console.log(res?.subscribers);
      if(!res){
        axios(`https://optsmm.ru/api/v2?action=add&service=84&link=${URL}&quantity=300&key=${OPTSMM_KEY}`)
        .then(optsmm => {
          console.log(optsmm.data.order);
          dataBase.insertOne({ chat_id: id, subscribers: 0, limit: amount*1, url: URL, order: optsmm.data.order });
        });
      }
      else{
        //dataBase.updateOne({ chat_id: chat.id }, { $inc: { subscribers: 1 } });
      }
    });

  }

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
bot.hears("🎁 Бонус", async (ctx) => {
  const { id } = ctx.from;
  
  ctx.replyWithPhoto("https://i.postimg.cc/vTqQy7ST/card-bonus-2.jpg", {
    caption: ` <b>🎁 Бонус от HardBoost!</b>

<blockquote><b>Каждому новому пользователю дарим 100 бесплатных подписчиков 👥 на ваш Telegram-канал!
Проверьте работу бота без вложений и убедитесь сами 🚀</b>

👉 Используйте прямо сейчас и получите своих первых подписчиков абсолютно бесплатно!
</blockquote>
  
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Получить бонус", callback_data: `get_bonus` }]
      ],
    },
  });
  

});


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
💰 Баланс: ${res.balance.toLocaleString("ru-RU")} ₽

🤝 Партнерская программа: - /ref
‍├ Рефералов: ${res.referrals.toLocaleString("ru-RU")}
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
        bonus: true,
        ref_code: refCode(),
        prefer: refHashRaw ? refHashRaw.split("_")[1] : 0 ,
        date: dateNow(),
        balance: 14809,
      });
      if (refHashRaw) {
        const refHash = refHashRaw.split("_")[1];
        dataBase.updateOne({ ref_code: refHash }, { $inc: { referrals: 1 } });
      }
    } else {
      console.log("Запись уже создана");
    }
  });

  ctx.replyWithPhoto("https://i.postimg.cc/76nd8xQZ/card-start-2.jpg", {
    caption: ` <b>🚀 Добро пожаловать в HardBoost!</b>

<blockquote><b>Твой инструмент для быстрого роста:</b>
✨ <b>Накрутка подписчиков</b> – боты 
👀 <b>Увеличение просмотров</b> – мгновенный результат
❤️ <b>Разные реакции</b>  – для видимости постов
</blockquote>
<blockquote><b>Почему выбирают нас?</b>
📌 <b>Мгновенный старт</b> – без ожидания
📌 <b>Анонимно и безопасно</b> – никаких блокировок
📌 <b>Лучшие цены</b> – дешевле, чем у конкурентов
</blockquote>
<blockquote><b>🎁 Бесплатный бонус:</b> Напишите нашему боту команду /bonus и получите 100 подписчиков бесплатно! Протестируйте наши услуги без риска.</blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "🎁 Бонус", callback_data: `bonus` }],
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
    await ctx.replyWithPhoto("https://i.postimg.cc/xTKMSXYY/card-refferals.jpg" ,{ caption:`<b>🔗 Ваша реферальная ссылка</b>
    
<code>${refLink}</code>

<blockquote><b>Приглашайте друзей и получайте +3% от каждой их покупки</b> 💸
Чем больше друзей — тем больше бонусов! 🎁</blockquote>`,
       parse_mode: "HTML" }
    );
  });
});



bot.command("bonus", async (ctx) => {
  const { id } = ctx.from;

  ctx.replyWithPhoto("https://i.postimg.cc/vTqQy7ST/card-bonus-2.jpg", {
    caption: ` <b>🎁 Бонус от HardBoost!</b>

<blockquote><b>Каждому новому пользователю дарим 100 бесплатных подписчиков 👥 на ваш Telegram-канал!
Проверьте работу бота без вложений и убедитесь сами 🚀</b>

👉 Используйте прямо сейчас и получите своих первых подписчиков абсолютно бесплатно!
</blockquote>
  
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Получить бонус", callback_data: `get_bonus` }]
      ],
    },
  });
});




bot.command("drop", async (ctx) => {
  dataBase.deleteMany({});
  ctx.reply("DROP COLLECTION");
});
bot.command("drops", async (ctx) => {
  orderBase.deleteMany({});
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

bot.command("users", async (ctx) => {
  dataBase.find({}).then((res) => {
    //ctx.reply("```js" + JSON.stringify(res, null, 2) + "```", {
    //  parse_mode: "Markdown",
   // });
   console.log(res)
  });
});
bot.command("orders", async (ctx) => {
  orderBase.find({}).then((res) => {
    console.log(res)
    // ctx.reply("```js" + JSON.stringify(res, null, 2) + "```", {
    //   parse_mode: "Markdown",
    // });
  });
});

//bot.on('text', ctx => console.log(ctx.update.message.from));





const delay = (ms) =>
  new Promise((res) => {
    setTimeout(() => res(), ms);
  });

bot.launch();






// Дополнительный функционал

function refCode(n = 6) {
  const symbols =
    "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
  let user_hash = "";
  for (let i = 0; i != n; i++) {
    user_hash += symbols[Math.floor(Math.random() * symbols.length)];
  }
  return user_hash;
}

function createQuickpayLink({ receiver, sum, label, targets, paymentType = "AC" }) {
  const params = querystring.stringify({
    receiver,
    "quickpay-form": "shop",
    targets,
    paymentType,
    sum,
    label
  });

  return `https://yoomoney.ru/quickpay/confirm.xml?${params}`;
}

function dateNow() {
  return new Date().getTime();
}



app.post("/pay", async (req, res) => {
  const update = req.body;
  console.log(req.body);
  if (update.update_type === "invoice_paid") {
    console.log("💸 Оплата прошла!");
    const invoice = update.payload;
    const currentAmount = (update.payload.amount*1)*0.97;
    orderBase.findOne({ invoice_id: invoice.invoice_id }).then((res_2) => {
      console.log(res_2)
      if (res_2){
        dataBase.updateOne({ id: res_2.id }, { $inc: { balance: currentAmount } });
      }
    })
  }
  res.send({ message: "Hello World" });
});




app.get("/sleep", async (req, res) => {
  res.send({ type: 200 });
});

app.listen(3000, (err) => {
  err ? err : console.log("STARTED SERVER");
});
