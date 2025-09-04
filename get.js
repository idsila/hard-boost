const axios = require('axios');
const dataBase = require("./dataBase.js");
const orderBase = require("./orderBase.js");

// const id = 7502494374;
// const id2 = 1383421742;

// const users = [7502400374, id, 7502400374, 7502400374, 7502400374, id2, 7502400374]

dataBase.find({}).then(users => {
  users.forEach(user => {
    if(user.id){
      axios.post('https://hard-boost-bot.onrender.com/send-ref', { id: user.id })
      .then(response => {
        console.log('✅ Сервер ответил:', response.data);
      })
      .catch(error => {
        console.error('❌ Ошибка при отправке запроса:', error.message);
      });
    }
    else{
      console.log(user)
    }
  })
})



// users.forEach(user => {
//   axios.post('https://hard-boost-bot.onrender.com/send-ref', { id: id })
//   .then(response => {
//     console.log('✅ Сервер ответил:', response.data);
//   })
//   .catch(error => {
//     console.error('❌ Ошибка при отправке запроса:', error.message);
//   });
// })


// axios.post('http://localhost:3000/send-ref', { id: id })
// .then(response => {
//   console.log('✅ Сервер ответил:', response.data);
// })
// .catch(error => {
//   console.error('❌ Ошибка при отправке запроса:', error.message);
// });



// axios.post('http://localhost:3000/send-user', { id: id , msg: 'HEllo'})
// .then(response => {
//   console.log('✅ Сервер ответил:', response.data);
// })
// .catch(error => {
//   console.error('❌ Ошибка при отправке запроса:', error.message);
// });