const tk = { "access_token": "4100119146265962.C0504F4219FE3461330A07F975A21BC6448F002E49216EBB55F0106FD6C52ACD9CB6E5ED6C7995BA1F6D3BAFB632CCF09B6A7A1DFF69735E0973BEFD0EE2B63A69F5E867D190EC047309C9D23D855D10FB80EB35DD614949BE8FF0D80B64E9AECA9026D8C2B01B1352C11FFB21136DAF8D78AA112C749973949B449FD755B215"}



const axios = require("axios");
const querystring = require("querystring");

async function getAccountInfo(token) {
  const res = await axios.post(
    "https://yoomoney.ru/api/account-info",
    {}, // тело пустое
    { headers: { Authorization: `Bearer ${tk.access_token}` } }
  );
  console.log(res.data);
}

getAccountInfo("ВАШ_ACCESS_TOKEN");



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

// const link = createQuickpayLink({
//   receiver: "4100119146265962",
//   sum: "50.00",
//   label: "order-777",
//   targets: "Оплата товара №777"
// });

//console.log("Ссылка на оплату:", link);





async function checkPayment(token, label) {
  const response = await axios.post(
    "https://yoomoney.ru/api/operation-history",
    { label }, // фильтруем по вашему label
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const operations = response.data.operations || [];
  if (operations.length === 0) {
    console.log("❌ Платеж с таким label не найден");
    return false;
  }

  const payment = operations[0]; // последний платёж с этим label
  if (payment.status === "success") {
    console.log("✅ Оплата подтверждена:", payment);
    //Должно идти начисление за отплату на счет
    return true;
  } else {
    console.log("⏳ Платёж ещё не завершён:", payment.status);
    return false;
  }
}

// Пример вызова
checkPayment(tk.access_token, "order-777");



