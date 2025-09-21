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

// Переменные для работы
const OPTSMM_KEY = process.env.OPTSMM_KEY;
const ADMIN_ID = process.env.ADMIN_ID;
const KF = 1.5;
let timerOrder = null;

let obj = JSON.parse(fs.readFileSync("log.json"));

let followers = obj.filter((item) => item.name.includes("одписчики") && item.category === "Telegram");
let views = obj.filter((item) => item.name.includes("росмотр") && item.category === "Telegram реакции/просмотры");
let reactions = obj.filter( (item) => item.name.includes("еакци") && item.category === "Telegram реакции/просмотры");
let boosts = obj.filter((item) => item.category === "Telegram Boost");
let stars = obj.filter((item) => item.name === "Telegram Stars на Аккаунт");


function getNewService(){
  axios(`https://optsmm.ru/api/v2?action=services&key=${OPTSMM_KEY}`).then(res => { 
  obj = res.data;
  obj.forEach(item => item.rate = item.rate*KF);
  followers = obj.filter((item) => item.name.includes("одписчики") && item.category === "Telegram");
  views = obj.filter((item) => item.name.includes("росмотр") && item.category === "Telegram реакции/просмотры");
  reactions = obj.filter( (item) => item.name.includes("еакци") && item.category === "Telegram реакции/просмотры");
  boosts = obj.filter((item) => item.category === "Telegram Boost");
  stars = obj.filter((item) => item.name === "Telegram Stars на Аккаунт");
});
}


getNewService();

setInterval(getNewService,(1000*60*60)*60 );





app.use(cors({ methods: ["GET", "POST"] }));
app.use(express.json());



const bot = new Telegraf(process.env.TOKEN);

bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),
    defaultSession: () => ({ order_scena: false }),
  })
);





bot.telegram.setMyCommands(commands);


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
        ((currentService.rate)) * (ctx.message?.text * 1);
      ctx.wizard.state.currentService = currentService;
      return ctx.wizard.next();
    } else {
      ctx.reply(
        `<b>📝 Напишите нужное вам колличество:</b>

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ценна за 1шт: ${((currentService.rate)).toLocaleString(
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
              completed: false
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
    
    if(currentService.name.includes("одписчики") && currentService.category === "Telegram"){
      console.log('Подписчики')
      ctx.wizard.state.descriptionService = `<b>📝 Отправьте сылку на канал:</b>\n<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/channel</code>`
    }
    else if(currentService.name.includes("росмотр") && currentService.category === "Telegram реакции/просмотры"){
      console.log('Просмотры')
      ctx.wizard.state.descriptionService = `<b>📝 Отправьте сылку на пост из публичного канала:</b>\n<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/channel/2056</code>`
    }
    else if(currentService.name.includes("еакци") && currentService.category === "Telegram реакции/просмотры"){
      console.log('Реакции')
      ctx.wizard.state.descriptionService = `<b>📝 Отправьте сылку на пост из публичного канала:</b>\n<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/channel/2056</code>`

    }
    else if(currentService.name === "Telegram Stars на Аккаунт"){
      console.log('Звёзды')
      ctx.wizard.state.descriptionService = `<b>📝 Отправьте сылку на аккаунт:</b>\n<code>⚠️ Ссылка должна быть в формате:\nhttps://t.me/username</code>`
    }
    
    
    
    if (
      ctx.message?.text >= currentService.min &&
      ctx.message?.text <= currentService.max
    ) {
      ctx.reply(
        `${ctx.wizard.state.descriptionService}
        
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
        ((currentService.rate) / 1000) * (ctx.message?.text * 1);
      ctx.wizard.state.currentService = currentService;
      return ctx.wizard.next();
    } else {
      ctx.reply(
        `<b>📝 Напишите нужное вам колличество:</b>

<blockquote>Услуга: ${currentService.name}</blockquote>
<blockquote>Ценна за 1шт: ${((currentService.rate) / 1000).toLocaleString(
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
              completed: false
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
        `${ctx.wizard.state.descriptionService}

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
              amount: 150,
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


              axios(`https://optsmm.ru/api/v2?action=add&service=84&link=${URL}&quantity=150&key=${OPTSMM_KEY}`)
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
<blockquote>💰 Заряд: ${(optsmm.data.charge*1.5).toLocaleString("ru-RU")}₽</blockquote>
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
              if(res_1.prefer){
                dataBase.updateOne({ ref_code: res_1.prefer }, { $inc : { balance: res_0.price*0.10 }});
                dataBase.findOne({ ref_code: res_1.prefer }).then(user => {
                  try {
                  bot.telegram.sendMessage(user.id,`<b>🎉 Ваш реферал совершил покупку!</b>
<blockquote><b>💸 Вам начислено:</b> 10% от суммы</blockquote>
<blockquote><b>💰 Сумма вознаграждения:</b> ${(res_0.price*0.10).toFixed(3)}₽</blockquote>
                    `, { parse_mode:'HTML' });
                  }
                  catch(error){
                    console.log(error);
                  }
                })
              

              }
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
  const { id, username } = ctx.from;
  
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
  const { id, username } = ctx.from;
 
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
    caption: "<blockquote><b>Выберите один из представленных товаров.</b></blockquote>",
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
      caption: "<blockquote><b>Выберите один из представленных товаров.</b></blockquote>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Способы пополнения </b></blockquote>`,{ parse_mode:'HTML' })

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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Пополнения ЮMoney</b></blockquote>`,{ parse_mode:'HTML' })

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.ibb.co/fbWNWJY/card-1003.jpg",
      caption: "<b>💸 Это пополнения баланса через карту или ЮMoney.</b>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Пополнения Крипта</b></blockquote>`,{ parse_mode:'HTML' })

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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Купить подписчики</b></blockquote>`,{ parse_mode:'HTML' })


  const keyboard = followers.map((item) => {
    return [
      {
        text: `${item.name} → ${(item.rate).toFixed(1)}₽`,
        callback_data: `followers_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/LX8g0C3p/card-subers.jpg",
      caption: "<blockquote><b>Ниже представлены тарифы и их цены за 1 тысячу.</b></blockquote>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Купить просмотры</b></blockquote>`,{ parse_mode:'HTML' })

  const keyboard = views.map((item) => {
    return [
      {
        text: `${item.name} → ${(item.rate).toFixed(1)}₽`,
        callback_data: `views_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/zfcH6wtH/card-views.jpg",
      caption: "<blockquote><b>Ниже представлены тарифы и их цены за 1 тысячу.</b></blockquote>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Купить реакции</b></blockquote>`,{ parse_mode:'HTML' })

  const keyboard = reactions.map((item) => {
    return [
      {
        text: `${item.name} → ${(item.rate).toFixed(1)}₽`,
        callback_data: `reactions_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/cCQKvpsf/card-reactions.jpg",
      caption: "<blockquote><b>Ниже представлены тарифы и их цены за 1 тысячу.</b></blockquote>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Купить буст</b></blockquote>`,{ parse_mode:'HTML' })

  const keyboard = boosts.map((item) => {
    return [
      {
        text: `${item.name} → ${(item.rate).toFixed(1)}₽`,
        callback_data: `boosts_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/C5H1hbNN/card-boosts.jpg",
      caption: "<blockquote><b>Ниже представлены тарифы и их цены за 1 шт.</b></blockquote>",
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: Купить звезды</b></blockquote>`,{ parse_mode:'HTML' })

  const keyboard = stars.map((item) => {
    return [
      {
        text: `${item.name} → ${(item.rate).toFixed(1)}₽`,
        callback_data: `stars_${id}_${item.service}`,
      },
    ];
  });

  keyboard.push([{ text: "<< Назад", callback_data: `menu_back` }]);

  await ctx.editMessageMedia(
    {
      type: "photo",
      media: "https://i.postimg.cc/Wb13yzft/card-1005.jpg",
      caption: "<blockquote><b>Ниже представлены тарифы и их цены за 1 тысячу.</b></blockquote>",
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
let hash_code = null;

bot.on("channel_post", async (ctx) => {
  const { text, chat: { id, title } } = ctx.channelPost;
  

  if(text.includes('/start')){
    hash_code = refCode();

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

    bot.telegram.sendMessage(ADMIN_ID, `Код для активации накрутки: <code>${hash_code}</code>`, { parse_mode:'HTML'});

  }


  
});

// bot.command("check", async (ctx) => {
//   const { id } = ctx.from;
//   const use = await bot.telegram.getChatMember(-1002760111651, id);
//   if (use.status !== "left") {
//     ctx.reply("+");
//   } else {
//     ctx.reply("-");
//   }
// });

// Действия по нажатию кнопки из keyboard
bot.hears("🎁 Бонус", async (ctx) => {
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: 🎁 Бонус</b></blockquote>`,{ parse_mode:'HTML' })

  
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: 🗂️ Меню</b></blockquote>`,{ parse_mode:'HTML' })

  await ctx.deleteMessage();
  await ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "<blockquote><b>Выберите один из представленных товаров.</b></blockquote>",
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
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: 👨 Личный кабинет</b></blockquote>`,{ parse_mode:'HTML' })

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
  console.log(id, first_name, username);
  const refHashRaw = ctx.payload;

  console.log(refHashRaw);
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь добавился:\n id:<code>${id}</code>  @${username}</b></blockquote>`,{ parse_mode:'HTML' })

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
        balance: 0,
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
    caption: `<b>🚀 HardBoost – быстрый буст для Telegram!</b>

✨ <b>Подписчики</b>, <b>просмотры</b>, <b>реакции</b>  
⭐️ <b>Telegram-звёзды</b>  
📈 <b>Рост каналов и постов</b>

<b>Преимущества:</b>  
📌 <b>Старт сразу /menu</b>
📌 <b>Анонимно и безопасно</b>
📌 <b>Лучшие цены</b>

<blockquote>🎁 <b>Бонус:</b> отправь /bonus и получи <b>100 подписчиков бесплатно!</b>  
</blockquote>
    
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
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: /ref</b></blockquote>`,{ parse_mode:'HTML' })


  dataBase.findOne({ id }).then(async (res) => {
    const refLink = `https://t.me/${ctx.botInfo.username}?start=ref_${res.ref_code}`;
    await ctx.replyWithPhoto("https://i.postimg.cc/xTKMSXYY/card-refferals.jpg" ,{ caption:`<b>🔗 Ваша реферальная ссылка</b>
    
<code>${refLink}</code>

<blockquote><b>Приглашайте друзей и получайте +10% от каждой их покупки</b> 💸
Чем больше друзей — тем больше бонусов! 🎁</blockquote>`,
       parse_mode: "HTML" }
    );
  });
});



bot.command("bonus", async (ctx) => {
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: /bonus</b></blockquote>`,{ parse_mode:'HTML' })


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


bot.command("menu", async (ctx) => {
  const { id, username } = ctx.from;
  bot.telegram.sendMessage(ADMIN_ID, `<blockquote><b>Пользователь \n id:<code>${id}</code>  @${username}\n Использовал: /menu</b></blockquote>`,{ parse_mode:'HTML' })

  await ctx.deleteMessage();
  await ctx.replyWithPhoto("https://i.ibb.co/qYJqZjqG/card-1001.jpg", {
    caption: "<blockquote><b>Выберите один из представленных товаров.</b></blockquote>",
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



app.post("/send-user", async (req, res) => {
  const { id, msg } = req.body;
  try {
  await bot.telegram.sendMessage(id, msg, { parse_mode: 'HTML'})
  res.send({ type: 200 });
  }
  catch(error){
    if (error.response && error.response.error_code === 403) {
      console.log(`Пользователь ${id} заблокировал бота`);
    } else {
      console.error("Ошибка при отправке:", error);
    }
    res.send({ type: 404 });
  }
});



app.post('/send-ref', async (req, res) => {
  const { id } = req.body;
  console.log(id);
  dataBase.findOne({ id }).then(async (user) => {
    if(user){
    const refLink = `https://t.me/${user.username}?start=ref_${user.ref_code}`;
    try {
      await bot.telegram.sendPhoto(id, "https://i.postimg.cc/xTKMSXYY/card-refferals.jpg" ,{ caption:`<b>🔗 Ваша реферальная ссылка</b>
    
<code>${refLink}</code>

<blockquote><b>Приглашайте друзей и получайте +10% от каждой их покупки</b> 💸
Чем больше друзей — тем больше бонусов! 🎁</blockquote>`,
       parse_mode: "HTML" }
      );
      res.send({ type: 200 });
   }
   catch(error){
    if (error.response && error.response.error_code === 403) {
      console.log(`Пользователь ${id} заблокировал бота`);
      // можно удалить chatId из базы
    } else {
      console.error("Ошибка при отправке:", error);
      
    }
    res.send({ type: 404 });
   }
  }
  else{
    res.send({ type: 404 });
  }
  });
});

app.get("/sleep", async (req, res) => {
  res.send({ type: 200 });
});



app.listen(3000, (err) => {
  err ? err : console.log("STARTED SERVER");
});
