const axios = require('axios');
const fs = require('fs');
const apiKey = '4jcFkaSGGyKv2NfdVYawzSW0VOZq9kQLcHGZmg5wiw1k3MICotJvl8EB7q7v';

axios(`https://optsmm.ru/api/v2?action=services&key=${apiKey}`)
.then(res => {
  fs.writeFileSync('log.json', JSON.stringify(res.data, null, 2), 'utf8');
  console.log(res.data)
})

// const amount = 1000;
// const service = 84;
// const url = 'https://t.me/+67kgqbaCk0gwZWIy';
// axios(`https://optsmm.ru/api/v2?action=add&service=${service}&link=${url}&quantity=${amount}&key=${apiKey}`)
// .then(res => {
//   console.log(res.data)
// })


// axios(`https://optsmm.ru/api/v2?action=status&order=165258662&key=${apiKey}`)
// .then(res => {
//   console.log(res.data)
// })