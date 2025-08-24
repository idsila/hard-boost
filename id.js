const express = require("express");
const axios = require("axios");
const querystring = require("querystring");

const app = express(); 

const YOOMONEY_CLIENT_ID = "54697821CEF46D8EF2E235FCA5FD1F68D9FEA370345A8798A18E6C2BFB9F4E92";



// Шаг 1: пользователь идёт на авторизацию
app.get("/login", (req, res) => {
  const url =
    "https://yoomoney.ru/oauth/authorize?" +
    querystring.stringify({
      client_id: YOOMONEY_CLIENT_ID,
      response_type: "code",
      redirect_uri: "http://localhost:3000/callback",
      scope: "account-info operation-history payment-p2p",
    });
  res.redirect(url);
});



// Шаг 2: ЮMoney редиректит сюда
app.get("/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send("Ошибка авторизации: " + error);

  try {
    const tokenResponse = await axios.post(
      "https://yoomoney.ru/oauth/token",
      querystring.stringify({
        code,
        client_id: YOOMONEY_CLIENT_ID,
        grant_type: "authorization_code",
        redirect_uri: "http://localhost:3000/callback",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    res.json(tokenResponse.data); // здесь будет access_token
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.send("Ошибка обмена кода на токен");
  }
});

app.listen(3000, () => console.log("Сервер запущен на http://localhost:3000"));
