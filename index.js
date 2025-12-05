const express = require('express')
const app = express()
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Chef is cooking!')
})

app.listen(port, () => {
  console.log(`Chef app listening on port ${port}`)
})
