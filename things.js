const fs = require('fs');



const obj = JSON.parse(fs.readFileSync('log.json'))

const tg  = obj.filter(item => item.category === 'Telegram')


module.exports = {

  followers: [
    {
      "service": 84,
      "name": "Подписчики ❌ Без гарантии",
      "type": "Default",
      "category": "Telegram",
      "network": null,
      "description": null,
      "rate": 4.8019,
      "min": 300,
      "max": 50000,
      "refill": false,
      "canceling_is_available": false,
      "cancel": false
    },
    {
      "service": 88,
      "name": "Подписчики ≈ 90 дней",
      "type": "Default",
      "category": "Telegram",
      "network": null,
      "description": null,
      "rate": 78.4313,
      "min": 100,
      "max": 500000,
      "refill": false,
      "canceling_is_available": false,
      "cancel": false
    },
    {
      "service": 89,
      "name": "Подписчики ≈ 7 дней",
      "type": "Default",
      "category": "Telegram",
      "network": null,
      "description": null,
      "rate": 49.9399,
      "min": 100,
      "max": 150000,
      "refill": false,
      "canceling_is_available": false,
      "cancel": false
    },
  ],

  views: [],

  reactions: [],

  boosts: []

};


console.log(tg)



const tk = "80AAEA6B7BFB2F76E535650DB560C023A464C42D5A7970A8EDD9FC9F7F684762";