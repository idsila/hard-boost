const axios = require('axios');
const id = 7502494374;

axios.post('http://localhost:3000/send-ref', { id: id })
.then(response => {
  console.log('✅ Сервер ответил:', response.data);
})
.catch(error => {
  console.error('❌ Ошибка при отправке запроса:', error.message);
});



// axios.post('http://localhost:3000/send-user', { id: id , msg: 'HEllo'})
// .then(response => {
//   console.log('✅ Сервер ответил:', response.data);
// })
// .catch(error => {
//   console.error('❌ Ошибка при отправке запроса:', error.message);
// });